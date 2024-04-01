import Product from "../models/product.model.js";
import Sale from "../models/sale.model.js";
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
      pricePerUnit,
      productName,
    });
    const savedSale = await newSale.save();

    res.status(201).json(savedSale);
  } catch (err) {
    next(err); // Handle validation errors or other bad requests
  }
};

export const getSales = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to see all sales"));
  }
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

export const totalSales = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to see total sales"));
  }
  const period = req.params.period; // Get the requested period
  const now = new Date();

  let matchCriteria = {};

  switch (period) {
    case "last-day":
      matchCriteria = {
        createdAt: { $gte: new Date(now - 24 * 60 * 60 * 1000) },
      }; // Last 24 hours
      break;
    case "last-week":
      matchCriteria = {
        createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
      }; // Last week
      break;
    case "last-month":
      matchCriteria = {
        createdAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 1, 1) },
      }; // Last month
      break;
    default:
      return res.status(400).json({ message: "Invalid period" }); // Handle invalid period
  }

  try {
    const totalSales = await Sale.aggregate([
      { $match: matchCriteria },
      { $group: { _id: null, total: { $sum: "$totalPrice" } } },
    ]);

    if (!totalSales.length) {
      return res.json({ total: 0 }); // Handle no sales found
    }

    res.json({ total: totalSales[0].total }); // Return the total sales amount
  } catch (err) {
    next(errorHandler(500, "Error retrieving total sales")); // Handle errors
  }
};
