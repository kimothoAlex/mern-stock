import Product from "../models/product.model.js";
import Sale from "../models/sale.model.js";
import Register from "../models/register.model.js";
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

    if (!registerId) {
      return next(errorHandler(400, "Register is required."));
    }

    const register = await Register.findOne({
      _id: registerId,
      cashierId: req.user.id,
      status: "OPEN",
    });

    if (!register) {
      return next(errorHandler(403, "No open register found."));
    }

    if (!Array.isArray(items) || items.length === 0) {
      return next(errorHandler(400, "Cart is empty."));
    }

    if (!payment?.method || !["CASH", "MPESA"].includes(payment.method)) {
      return next(errorHandler(400, "Payment method required."));
    }

    const amountPaid = Number(payment.amountPaid || 0);
    if (amountPaid <= 0) {
      return next(errorHandler(400, "amountPaid is required."));
    }

    // if (payment.method === "MPESA" && !payment.mpesaCode?.trim()) {
    //   return next(errorHandler(400, "M-Pesa code required."));
    // }

    // Load products
    const ids = items.map((i) => i.productId);
    const products = await Product.find({ _id: { $in: ids } });
    const map = new Map(products.map((p) => [String(p._id), p]));

    let subtotal = 0;
    const receiptItems = [];

    for (const line of items) {
      const qty = Number(line.qty);
      const p = map.get(String(line.productId));

      if (!p) return next(errorHandler(404, "Product not found"));
      if (p.quantity < qty) {
        return next(errorHandler(400, `Not enough stock for ${p.name}`));
      }

      const lineTotal = p.price * qty;
      subtotal += lineTotal;

      receiptItems.push({
        productId: p._id,
        productName: p.name,
        barcode: p.barcode || "",
        pricePerUnit: p.price,
        quantity: qty,
        totalPrice: lineTotal,
      });
    }

    const disc = Math.max(0, Number(discount));
    const total = subtotal - disc;

    if (amountPaid < total) {
      return next(errorHandler(400, "Amount paid is less than total."));
    }

    const change =
      payment.method === "CASH" ? amountPaid - total : 0;

    // Deduct stock
    for (const line of items) {
      await Product.updateOne(
        { _id: line.productId },
        { $inc: { quantity: -Number(line.qty) } }
      );
    }

    // ✅ Save sale (receiptNo auto generated)
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
        // mpesaCode: payment.method === "MPESA" ? payment.mpesaCode.trim() : "",
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

    // ✅ Respond once — sale is guaranteed defined
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