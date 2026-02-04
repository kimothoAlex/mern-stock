import Product from "../models/product.model.js";
import Sale from "../models/sale.model.js";
import Register from "../models/register.model.js";
import ProductVariant from "../models/productVariant.model.js";
import { errorHandler } from "../utils/error.js";

export const createSale = async (req, res, next) => {
  try {
    const productId = req.params.productId;
    const existingProduct = await Product.findById(productId);
    if (!existingProduct) {
      return next(errorHandler(401, "Product not found"));
    }
    const pricePerUnit = existingProduct.price;
    const productName = existingProduct.name;
    const { quantity } = req.body;

    if (quantity > existingProduct.quantity) {
      return next(errorHandler(401, "Insufficient stock"));
    }

    const newSale = new Sale({
      productId,
      quantity,
      pricePerUnit: existingProduct.price,
      productName: existingProduct.name,
    });
    const savedSale = await newSale.save();

    res.status(201).json({
      success: true,
      receipt: {
        receiptNo: savedSale.receiptNo,
        productName: savedSale.productName,
        quantity: savedSale.quantity,
        pricePerUnit: savedSale.pricePerUnit,
        totalPrice: savedSale.totalPrice,
        dateSold: savedSale.dateSold,
        createdAt: savedSale.createdAt,
      },});
  } catch (err) {
    next(err); // Handle validation errors or other bad requests
  }
};

export const checkoutSale = async (req, res, next) => {
  try {
    const { registerId, items, discount = 0, payment } = req.body;

    if (!registerId) return next(errorHandler(400, "Register is required."));

    const register = await Register.findOne({
      _id: registerId,
      cashierId: req.user.id,
      status: "OPEN",
    });

    if (!register) return next(errorHandler(403, "No open register found."));

    if (!Array.isArray(items) || items.length === 0) {
      return next(errorHandler(400, "Cart is empty."));
    }

    if (!payment?.method || !["CASH", "MPESA"].includes(payment.method)) {
      return next(errorHandler(400, "Payment method required."));
    }

    const amountPaid = Number(payment.amountPaid || 0);
    if (!Number.isFinite(amountPaid) || amountPaid <= 0) {
      return next(errorHandler(400, "amountPaid is required."));
    }

    // --- NEW: support lines that may contain variantId ---
    // Each line can be either:
    // { productId, qty }  (normal product)
    // OR
    // { variantId, qty }  (variant SKU)
    // You can also allow both, but variantId takes priority.

    const variantIds = items.filter((i) => i.variantId).map((i) => i.variantId);
    const productIds = items
      .filter((i) => i.productId)
      .map((i) => i.productId);

    const variants = variantIds.length
      ? await ProductVariant.find({ _id: { $in: variantIds }, isActive: true }).lean()
      : [];
    const variantMap = new Map(variants.map((v) => [String(v._id), v]));

    // For variants we need their base products
    const baseProductIdsFromVariants = variants.map((v) => v.productId);

    const allProductIds = [
      ...new Set([
        ...productIds.map(String),
        ...baseProductIdsFromVariants.map((x) => String(x)),
      ]),
    ];

    const products = allProductIds.length
      ? await Product.find({ _id: { $in: allProductIds } }).lean()
      : [];
    const productMap = new Map(products.map((p) => [String(p._id), p]));

    let subtotal = 0;
    const receiptItems = [];

    // Track how much base stock to deduct per product (in base units)
    // key: productId, value: baseQtyToDeduct
    const deductBase = new Map();

    // Helper: get stock in base units for ANY product
    const getStockBase = (p) => {
      // prefer stockBaseQty if exists, else fallback to quantity
      const s = p.stockBaseQty ?? p.quantity ?? 0;
      return Number(s || 0);
    };

    // Helper: validate numeric qty
    const parseQty = (q) => {
      const n = Number(q);
      if (!Number.isFinite(n) || n <= 0) return null;
      return n;
    };

    for (const line of items) {
      const qty = parseQty(line.qty);
      if (!qty) return next(errorHandler(400, "Invalid qty in cart."));

      // CASE A: Variant sale
      if (line.variantId) {
        const v = variantMap.get(String(line.variantId));
        if (!v) return next(errorHandler(404, "Variant not found"));

        const baseProduct = productMap.get(String(v.productId));
        if (!baseProduct) return next(errorHandler(404, "Base product not found"));

        const unitSizeInBase = Number(v.unitSizeInBase || 0);
        if (!Number.isFinite(unitSizeInBase) || unitSizeInBase <= 0) {
          return next(errorHandler(400, "Variant unit size invalid"));
        }

        const baseQtyNeeded = unitSizeInBase * qty;

        // record deduction (base product)
        const k = String(baseProduct._id);
        deductBase.set(k, (deductBase.get(k) || 0) + baseQtyNeeded);

        // price is variant price
        const pricePerUnit = Number(v.price || 0);
        const lineTotal = pricePerUnit * qty;
        subtotal += lineTotal;

        receiptItems.push({
          productId: baseProduct._id, // base product id
          variantId: v._id,           // NEW (recommended)
          productName: v.name,        // show variant name on receipt
          barcode: v.barcode || "",
          pricePerUnit,
          quantity: qty,
          totalPrice: lineTotal,
          baseQtyDeducted: baseQtyNeeded, // NEW (recommended)
        });

        continue;
      }

      // CASE B: Normal product sale (single SKU)
      const p = productMap.get(String(line.productId));
      if (!p) return next(errorHandler(404, "Product not found"));

      // For normal products, assume 1 qty = 1 base unit
      // (If baseUnit is pcs, this is correct. If you later want e.g. “1kg bulk entry” you’ll handle as variant/bulk)
      const baseQtyNeeded = qty;

      const k = String(p._id);
      deductBase.set(k, (deductBase.get(k) || 0) + baseQtyNeeded);

      const pricePerUnit = Number(p.price || 0);
      const lineTotal = pricePerUnit * qty;
      subtotal += lineTotal;

      receiptItems.push({
        productId: p._id,
        productName: p.name,
        barcode: p.barcode || "",
        pricePerUnit,
        quantity: qty,
        totalPrice: lineTotal,
        baseQtyDeducted: baseQtyNeeded, // optional
      });
    }

    // --- STOCK CHECK (important): validate totals before updating ---
    for (const [productId, baseQtyNeeded] of deductBase.entries()) {
      const p = productMap.get(String(productId));
      if (!p) return next(errorHandler(404, "Product not found"));

      const available = getStockBase(p);
      if (available < baseQtyNeeded) {
        // show clean name
        return next(errorHandler(400, `Not enough stock for ${p.name}`));
      }
    }

    const disc = Math.max(0, Number(discount));
    const total = subtotal - disc;

    if (total < 0) return next(errorHandler(400, "Total cannot be negative."));
    if (amountPaid < total) return next(errorHandler(400, "Amount paid is less than total."));

    const change = payment.method === "CASH" ? amountPaid - total : 0;

    // --- DEDUCT STOCK (atomic per product) ---
    // Use stockBaseQty if you migrated, else fallback to quantity
    // Best: always use stockBaseQty going forward.
    const bulkOps = [];
    for (const [productId, baseQtyNeeded] of deductBase.entries()) {
      bulkOps.push({
        updateOne: {
          filter: { _id: productId },
          update: { $inc: { stockBaseQty: -baseQtyNeeded } },
        },
      });
    }

    if (bulkOps.length) {
      await Product.bulkWrite(bulkOps);
    }

    // ✅ Save sale
    const sale = await Sale.create({
      registerId: register._id,
      cashierId: req.user.id,
      items: receiptItems,
      subtotal,
      discount: disc,
      total,
      payment: {
        method: payment.method,
        amountPaid,
        change,
      },
      dateSold: new Date(),
    });

    // ✅ Update register totals
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
    );

    return res.status(201).json({ success: true, sale });
  } catch (err) {
    next(err);
  }
};

// ✅ Update this if you want totals by period (changed from totalPrice -> total)
export const totalSales = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to see total sales"));
  }

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
    const agg = await Sale.aggregate([
      { $match: matchCriteria },
      { $group: { _id: null, total: { $sum: "$total" } } }, // ✅ changed
    ]);

    res.json({ total: agg.length ? agg[0].total : 0 });
  } catch (err) {
    next(errorHandler(500, "Error retrieving total sales"));
  }
};

export const getSales = async (req, res, next) => {
  // if (!req.user.isAdmin) {
  //   return next(errorHandler(403, "You are not allowed to see all sales"));
  // }
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

    const oneMonthAgo = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      now.getDate()
    );
    const lastMonthSales = await Sale.countDocuments({
      createdAt: { $gte: oneMonthAgo },
    });

    const lastWeekSales = await Sale.countDocuments({
      createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
    });

    const lastDaySales = await Sale.countDocuments({
      createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
    });

    res.status(200).json({
      sales,
      totalSales,
      lastMonthSales,
      lastWeekSales,
      lastDaySales,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSale = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to delete this sale"));
  }
  try {
    await Sale.findByIdAndDelete(req.params.saleId);
    res.status(200).json("The sale has been deleted");
  } catch (error) {
    next(error);
  }
};

// export const totalSales = async (req, res, next) => {
//   if (!req.user.isAdmin) {
//     return next(errorHandler(403, "You are not allowed to see total sales"));
//   }
//   const period = req.params.period; // Get the requested period
//   const now = new Date();

//   let matchCriteria = {};

//   switch (period) {
//     case "last-day":
//       matchCriteria = {
//         createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
//       }; // Last 24 hours
//       break;
//     case "last-week":
//       matchCriteria = {
//         createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
//       }; // Last week
//       break;
//     case "last-month":
//       matchCriteria = {
//         createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) },
//       }; // Last month
//       break;
//     default:
//       return res.status(400).json({ message: "Invalid period" }); // Handle invalid period
//   }

//   try {
//     const totalSales = await Sale.aggregate([
//       { $match: matchCriteria },
//       { $group: { _id: null, total: { $sum: "$totalPrice" } } },
//     ]);

//     if (!totalSales.length) {
//       return res.json({ total: 0 }); // Handle no sales found
//     }

//     res.json({ total: totalSales[0].total }); // Return the total sales amount
//   } catch (err) {
//     next(errorHandler(500, "Error retrieving total sales")); // Handle errors
//   }
// };

export const lastDaySales = async (req,res,next) =>{
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to delete this sale"));
  }
try {
  const now = new Date();
  const lastDaySales= await Sale.find({ createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) }});
  res.status(200).json(lastDaySales);
} catch (error) {
  next(error);
}
}