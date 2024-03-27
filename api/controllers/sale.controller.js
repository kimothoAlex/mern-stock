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
      productName
    });
    const savedSale = await newSale.save();

    res.status(201).json(savedSale);
  } catch (err) {
    next(err); // Handle validation errors or other bad requests
  }
};

export const getSales = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, 'You are not allowed to see all sales'));
  }
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.sort === 'asc' ? 1 : -1;

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

    res.status(200).json({
      sales,
      totalSales,
      lastMonthSales,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteSale= async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, 'You are not allowed to delete this sale'));
  }
  try {
    await Sale.findByIdAndDelete(req.params.saleId);
    res.status(200).json('The sale has been deleted');
  } catch (error) {
    next(error);
  }
};