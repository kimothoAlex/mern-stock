import Product from "../models/product.model.js";
import { errorHandler } from "../utils/error.js";

export const create = async (req, res, next) => {
  if (
    !req.body.name ||
    !req.body.type ||
    !req.body.category ||
    !req.body.price ||
    !req.body.quantity
  ) {
    return next(errorHandler(400, "Please provide all required fields"));
  }
  const slug = req.body.name
    .split(" ")
    .join("-")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, "");

  const newProduct = new Product({
    ...req.body,
    slug,
    userId: req.user.id,
  });

  try {
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    next(error);
  }
};

export const getproducts = async (req, res, next) => {
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.order === "asc" ? 1 : -1;
    const products = await Product.find({
      ...(req.query.userId && { userId: req.query.userId }),
      ...(req.query.category && { category: req.query.category }),
      ...(req.query.type && { type: req.query.type }),
      ...(req.query.slug && { slug: req.query.slug }),
      ...(req.query.productId && { _id: req.query.productId }),
      ...(req.query.searchTerm && {
        name: { $regex: req.query.searchTerm, $options: "i" },
      }),
    })
      .sort({ updatedAt: sortDirection })
      .skip(startIndex)
      .limit(limit);

    const totalProducts = await Product.countDocuments();

    res.status(200).json({
      products,
      totalProducts,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteproduct = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(
      errorHandler(403, "You are not allowed to delete this product")
    );
  }
  try {
    await Product.findByIdAndDelete(req.params.productId);
    res.status(200).json("The product has been deleted");
  } catch (error) {
    next(error);
  }
};

export const updateproduct = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(
      errorHandler(403, "You are not allowed to update this product")
    );
  }
  try {
    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.productId,
      {
        $set: {
          name: req.body.name,
          type: req.body.type,
          category: req.body.category,
          price: req.body.price,
          quantity: req.body.quantity,
          image: req.body.image,
        },
      },
      { new: true }
    );
    res.status(200).json(updatedProduct);
  } catch (error) {
    next(error);
  }
};

export const aggProducts = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to view the ranks"));
  }
  const limit = parseInt(req.query.limit) || 10; // Default or query param for number of results

  try {
    const [topSold, leastSold] = await Promise.all([
      // Aggregation for top sold products
      Product.aggregate([
        {
          $lookup: {
            from: "sales",
            localField: "_id",
            foreignField: "productId",
            as: "salesData",
          },
        },
        { $unwind: "$salesData" },
        {
          $group: {
            _id: "$_id",
            totalSales: { $sum: "$salesData.quantity" },
            productName: { $first: "$name" },
            amountGenerated: { $sum: "$salesData.totalPrice" },
          },
        },
        { $sort: { totalSales: -1 } }, // Sort by total sales (descending)
        { $limit: limit },
      ]),
      // Aggregation for least sold products
      Product.aggregate([
        {
          $lookup: {
            from: "sales",
            localField: "_id",
            foreignField: "productId",
            as: "salesData",
          },
        },
        { $unwind: { path: "$salesData", preserveNullAndEmptyArrays: true } }, // Include products with no sales
        {
          $group: {
            _id: "$_id",
            totalSales: { $sum: "$salesData.quantity" },
            productName: { $first: "$name" },
            amountGenerated: { $sum: "$salesData.totalPrice" },
          },
        },
        { $sort: { totalSales: 1 } }, // Sort by total sales (ascending)
        { $limit: limit },
      ]),
    ]);

    res.json({ topSold, leastSold });
  } catch (err) {
    next(errorHandler(500, "Error retrieving sales ranks"));
  }
};

export const lowStockProducts = async (req, res, next)=>{
  try {
    const reorderPoint = 3;
    const products = await Product.find({ quantity: { $lt: reorderPoint } });
    const reducedProducts = products.reduce((acc, product) => {
      acc[product.name] = product.quantity;
      return acc;
    }, {});
    const lowStockProducts = Object.entries(reducedProducts).map(
      (productName) => productName[0]
    );
    if (lowStockProducts.length > 0) {
      res.status(200).json({lowStockProducts});
    }

    
  } catch (error) {
    next(errorHandler(500, "Error retrieving products"));
  }
}