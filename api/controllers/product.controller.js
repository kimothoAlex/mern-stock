import Product from "../models/product.model.js";
import { errorHandler } from "../utils/error.js";

export const create = async (req, res, next) => {
  // barcode is now OPTIONAL
  if (
    !req.body.name ||
    !req.body.category ||
    req.body.price === undefined ||
    req.body.quantity === undefined
  ) {
    return next(errorHandler(400, "Please provide all required fields"));
  }

  const slug = String(req.body.name)
    .trim()
    .split(" ")
    .join("-")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, "");

  try {
    // Friendly duplicate checks
    const existingName = await Product.findOne({ name: req.body.name.trim() });
    if (existingName) return next(errorHandler(400, "Product name already exists"));

    // Only check barcode if provided
    if (req.body.barcode && String(req.body.barcode).trim() !== "") {
      const existingBarcode = await Product.findOne({ barcode: String(req.body.barcode).trim() });
      if (existingBarcode) return next(errorHandler(400, "Barcode already exists"));
    }

    const newProduct = new Product({
      ...req.body,
      name: req.body.name.trim(),
      barcode: req.body.barcode?.trim() || undefined, // optional
      type: req.body.type?.trim() || "general",       // default type
      slug,
      userId: req.user.id,
      price: Number(req.body.price),
      quantity: Number(req.body.quantity),
    });

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
      ...(req.query.barcode && { barcode: req.query.barcode }),
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
          imageUrl: req.body.imageUrl,
          barcode: req.body.barcode,
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
if (!req.user?.isAdmin) {
return next(errorHandler(403, "You are not allowed to view the ranks"));
}


const limit = parseInt(req.query.limit, 10) || 10;


try {
const basePipeline = [
{
$lookup: {
from: "sales",
let: { pid: "$_id" },
pipeline: [
{ $unwind: "$items" },
{ $match: { $expr: { $eq: ["$items.productId", "$$pid"] } } },
{
$group: {
_id: null,
totalSales: { $sum: "$items.quantity" },
amountGenerated: { $sum: "$items.totalPrice" },
},
},
],
as: "salesData",
},
},
{ $unwind: { path: "$salesData", preserveNullAndEmptyArrays: true } },
{
$addFields: {
totalSales: { $ifNull: ["$salesData.totalSales", 0] },
amountGenerated: { $ifNull: ["$salesData.amountGenerated", 0] },
},
},
{
$project: {
_id: 1,
productName: "$name", // <-- Product schema field
barcode: 1,
category: 1,
type: 1,
price: 1,
totalSales: 1,
amountGenerated: 1,
},
},
];


const [topSold, leastSold] = await Promise.all([
Product.aggregate([
...basePipeline,
{ $sort: { totalSales: -1 } },
{ $limit: limit },
]),
Product.aggregate([
...basePipeline,
{ $sort: { totalSales: 1 } },
{ $limit: limit },
]),
]);


res.status(200).json({ topSold, leastSold });
} catch (err) {
next(errorHandler(500, "Error retrieving sales ranks"));
}
};

export const lowStockProducts = async (req, res, next)=>{
  try {
    const reorderPoint = 9;
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