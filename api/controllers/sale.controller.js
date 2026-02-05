import mongoose from "mongoose";
import Product from "../models/product.model.js";
import Sale from "../models/sale.model.js";
import Register from "../models/register.model.js";
import ProductVariant from "../models/productVariant.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * Helpers
 */
const toNum = (v, fallback = undefined) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const cleanStr = (v) => String(v || "").trim();

const parseQty = (q) => {
  const n = Number(q);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

// Prefer stockBaseQty if present; else fallback to legacy quantity
const getStockBase = (p) => {
  if (p?.stockBaseQty !== undefined && p?.stockBaseQty !== null) return Number(p.stockBaseQty || 0);
  return Number(p?.quantity || 0);
};

// Deduct from stockBaseQty if it exists; else from quantity
const buildStockUpdate = (p, amountToDeduct) => {
  if (p?.stockBaseQty !== undefined && p?.stockBaseQty !== null) {
    return { field: "stockBaseQty", inc: -amountToDeduct };
  }
  return { field: "quantity", inc: -amountToDeduct };
};

/**
 * Legacy single product sale (optional)
 * If you still use this route, it only supports normal products (no variants).
 * Most systems can delete this and use checkoutSale only.
 */
export const createSale = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) return next(errorHandler(404, "Product not found"));

    const quantity = parseQty(req.body.quantity);
    if (!quantity) return next(errorHandler(400, "Invalid quantity"));

    // For legacy: deduct from quantity (or stockBaseQty if you want)
    const available = getStockBase(existingProduct);
    if (quantity > available) return next(errorHandler(400, "Insufficient stock"));

    // Deduct stock
    const { field, inc } = buildStockUpdate(existingProduct, quantity);
    await Product.updateOne({ _id: existingProduct._id }, { $inc: { [field]: inc } });

    const savedSale = await Sale.create({
      // legacy format (if your Sale schema supports this)
      productId,
      quantity,
      pricePerUnit: existingProduct.price,
      productName: existingProduct.name,
      totalPrice: existingProduct.price * quantity,
      dateSold: new Date(),
    });

    return res.status(201).json({
      success: true,
      receipt: {
        receiptNo: savedSale.receiptNo,
        productName: savedSale.productName,
        quantity: savedSale.quantity,
        pricePerUnit: savedSale.pricePerUnit,
        totalPrice: savedSale.totalPrice,
        dateSold: savedSale.dateSold,
        createdAt: savedSale.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * CHECKOUT (supports variants)
 * items can be:
 *  - { productId, qty } OR
 *  - { variantId, qty }
 */
export const checkoutSale = async (req, res, next) => {
  const session = await mongoose.startSession();

  try {
    const { registerId, items, discount = 0, payment } = req.body;

    if (!registerId) return next(errorHandler(400, "Register is required."));

    if (!Array.isArray(items) || items.length === 0) {
      return next(errorHandler(400, "Cart is empty."));
    }

    if (!payment?.method || !["CASH", "MPESA"].includes(payment.method)) {
      return next(errorHandler(400, "Payment method required."));
    }

    const amountPaid = toNum(payment.amountPaid, NaN);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return next(errorHandler(400, "amountPaid is required."));
    }

    // Read register (not in session is ok, but safer if done inside)
    const register = await Register.findOne({
      _id: registerId,
      cashierId: req.user.id,
      status: "OPEN",
    }).lean();

    if (!register) return next(errorHandler(403, "No open register found."));

    // Separate ids
    const variantIds = items.filter((i) => i?.variantId).map((i) => String(i.variantId));
    const productIds = items.filter((i) => i?.productId).map((i) => String(i.productId));

    // Load variants
    const variants = variantIds.length
      ? await ProductVariant.find({ _id: { $in: variantIds }, isActive: true }).lean()
      : [];
    const variantMap = new Map(variants.map((v) => [String(v._id), v]));

    // Load base products for variants + normal products
    const baseProductIdsFromVariants = variants.map((v) => String(v.productId));
    const allProductIds = [...new Set([...productIds, ...baseProductIdsFromVariants])];

    const products = allProductIds.length
      ? await Product.find({ _id: { $in: allProductIds } }).lean()
      : [];
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    // Build receipt + deductions
    let subtotal = 0;
    const receiptItems = [];
    const deductMap = new Map(); // productId -> qtyNeeded (base for variants, quantity for normal)

    for (const line of items) {
      const qty = parseQty(line?.qty);
      if (!qty) return next(errorHandler(400, "Invalid qty in cart."));

      // Variant line
      if (line?.variantId) {
        const v = variantMap.get(String(line.variantId));
        if (!v) return next(errorHandler(404, "Variant not found"));

        const baseProduct = productMap.get(String(v.productId));
        if (!baseProduct) return next(errorHandler(404, "Base product not found"));
          if (!baseProduct.hasVariants) {
    return next(
      errorHandler(400, `Product "${baseProduct.name}" is not configured for variants`)
    );
  }
        const unitSizeInBase = toNum(v.unitSizeInBase, NaN);
        if (!Number.isFinite(unitSizeInBase) || unitSizeInBase <= 0) {
          return next(errorHandler(400, "Variant unit size invalid"));
        }

        const baseQtyNeeded = unitSizeInBase * qty;

        const k = String(baseProduct._id);
        deductMap.set(k, (deductMap.get(k) || 0) + baseQtyNeeded);

        const pricePerUnit = toNum(v.price, 0);
        const lineTotal = pricePerUnit * qty;
        subtotal += lineTotal;

        receiptItems.push({
          kind: "VARIANT",
          productId: baseProduct._id,
          variantId: v._id,
          baseQtyDeducted: baseQtyNeeded,
          productName: v.name,
          barcode: v.barcode || "",
          pricePerUnit,
          quantity: qty,
          totalPrice: lineTotal,
        });

        continue;
      }

      // Normal product line
      const p = productMap.get(String(line.productId));
      if (!p) return next(errorHandler(404, "Product not found"));

      const qtyNeeded = qty; // for normal products, deduct in "quantity"
      const k = String(p._id);
      deductMap.set(k, (deductMap.get(k) || 0) + qtyNeeded);

      const pricePerUnit = toNum(p.price, 0);
      const lineTotal = pricePerUnit * qty;
      subtotal += lineTotal;

      receiptItems.push({
        kind: "PRODUCT",
        productId: p._id,
        baseQtyDeducted: qtyNeeded, // for normal products this is same as qty
        productName: p.name,
        barcode: p.barcode || "",
        pricePerUnit,
        quantity: qty,
        totalPrice: lineTotal,
      });
    }

    const disc = Math.max(0, toNum(discount, 0));
    const total = subtotal - disc;

    if (total < 0) return next(errorHandler(400, "Total cannot be negative."));
    if (amountPaid < total) return next(errorHandler(400, "Amount paid is less than total."));

    const change = payment.method === "CASH" ? amountPaid - total : 0;

    // ✅ Run transaction and RETURN sale (no res.json inside)
    const createdSale = await session.withTransaction(async () => {
      // deduct product by product with non-negative filter
      for (const [productId, qtyNeeded] of deductMap.entries()) {
        const p = productMap.get(String(productId));
        if (!p) throw errorHandler(404, "Product not found");

        const available = getStockBase(p);
        if (available < qtyNeeded) throw errorHandler(400, `Not enough stock for ${p.name}`);

        const { field, inc } = buildStockUpdate(p, qtyNeeded);

        const filter =
          field === "stockBaseQty"
            ? { _id: productId, stockBaseQty: { $gte: qtyNeeded } }
            : { _id: productId, quantity: { $gte: qtyNeeded } };

        const upd = await Product.updateOne(filter, { $inc: { [field]: inc } }).session(session);

        if (upd.modifiedCount !== 1) {
          throw errorHandler(400, `Not enough stock for ${p.name}`);
        }
      }

      const [sale] = await Sale.create(
        [
          {
            registerId: register._id,
            cashierId: req.user.id,
            items: receiptItems,
            subtotal,
            discount: disc,
            total,
            payment: { method: payment.method, amountPaid, change },
            dateSold: new Date(),
          },
        ],
        { session }
      );

      await Register.updateOne(
        { _id: register._id },
        {
          $inc: {
            salesCount: 1,
            grossSales: total,
            cashSales: payment.method === "CASH" ? total : 0,
            mpesaSales: payment.method === "MPESA" ? total : 0,
          },
        }
      ).session(session);

      return sale;
    });

    return res.status(201).json({ success: true, sale: createdSale });
  } catch (err) {
    return next(err);
  } finally {
    session.endSession();
  }
};

// ✅ Totals should sum Sale.total (you already fixed this)
export const totalSales = async (req, res, next) => {
  if (!req.user.isAdmin) return next(errorHandler(403, "You are not allowed to see total sales"));

  const period = req.params.period;
  const now = new Date();
  let matchCriteria = {};

  switch (period) {
    case "last-day":
      matchCriteria = { createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } };
      break;
    case "last-week":
      matchCriteria = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
      break;
    case "last-month":
      matchCriteria = { createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) } };
      break;
    default:
      return res.status(400).json({ message: "Invalid period" });
  }

  try {
    const agg = await Sale.aggregate([{ $match: matchCriteria }, { $group: { _id: null, total: { $sum: "$total" } } }]);
    return res.json({ total: agg.length ? agg[0].total : 0 });
  } catch (err) {
    next(errorHandler(500, "Error retrieving total sales"));
  }
};

export const getSales = async (req, res, next) => {
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === "asc" ? 1 : -1;

    const sales = await Sale.find()
      .sort({ createdAt: sortDirection })
      .skip(startIndex)
      .limit(limit);

    const totalSales = await Sale.countDocuments();

    const now = new Date();
    const oneMonthAgo = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());

    const lastMonthSales = await Sale.countDocuments({ createdAt: { $gte: oneMonthAgo } });
    const lastWeekSales = await Sale.countDocuments({ createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } });
    const lastDaySales = await Sale.countDocuments({ createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) } });

    return res.status(200).json({ sales, totalSales, lastMonthSales, lastWeekSales, lastDaySales });
  } catch (err) {
    next(err);
  }
};

export const deleteSale = async (req, res, next) => {
  if (!req.user.isAdmin) return next(errorHandler(403, "You are not allowed to delete this sale"));
  try {
    await Sale.findByIdAndDelete(req.params.saleId);
    return res.status(200).json("The sale has been deleted");
  } catch (err) {
    next(err);
  }
};

export const lastDaySales = async (req, res, next) => {
  if (!req.user.isAdmin) return next(errorHandler(403, "You are not allowed to view sales"));

  try {
    const now = new Date();
    const lastDaySales = await Sale.find({
      createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) }, // ✅ real last day
    });
    return res.status(200).json(lastDaySales);
  } catch (err) {
    next(err);
  }
};
