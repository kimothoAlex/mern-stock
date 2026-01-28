import Product from "../models/product.model.js";
import { errorHandler } from "../utils/error.js";

export const create = async (req, res, next) => {
  // barcode OPTIONAL
  if (
    !req.body.name ||
    !req.body.category ||
    req.body.price === undefined ||
    req.body.quantity === undefined
  ) {
    return next(errorHandler(400, "Please provide all required fields"));
  }

  const name = String(req.body.name).trim();
  const category = String(req.body.category).trim();

  const slug = name
    .split(" ")
    .join("-")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, "");

  try {
    // Friendly duplicate checks
    const existingName = await Product.findOne({ name });
    if (existingName) return next(errorHandler(400, "Product name already exists"));

    const barcode =
      req.body.barcode && String(req.body.barcode).trim() !== ""
        ? String(req.body.barcode).trim()
        : undefined;

    if (barcode) {
      const existingBarcode = await Product.findOne({ barcode });
      if (existingBarcode) return next(errorHandler(400, "Barcode already exists"));
    }

    // Cast numeric fields
    const price = Number(req.body.price);
    const quantity = Number(req.body.quantity);

    if (Number.isNaN(price) || price < 0)
      return next(errorHandler(400, "Valid price is required"));
    if (Number.isNaN(quantity) || quantity < 0)
      return next(errorHandler(400, "Valid quantity is required"));

    const costPrice =
      req.body.costPrice === undefined || req.body.costPrice === null || req.body.costPrice === ""
        ? undefined
        : Number(req.body.costPrice);

    const reorderLevel =
      req.body.reorderLevel === undefined || req.body.reorderLevel === null || req.body.reorderLevel === ""
        ? undefined
        : Number(req.body.reorderLevel);

    if (costPrice !== undefined && (Number.isNaN(costPrice) || costPrice < 0))
      return next(errorHandler(400, "Valid cost price is required"));

    if (reorderLevel !== undefined && (Number.isNaN(reorderLevel) || reorderLevel < 0))
      return next(errorHandler(400, "Valid reorder level is required"));

    const newProduct = new Product({
      userId: req.user.id,
      slug,

      name,
      category,

      type: req.body.type ? String(req.body.type).trim() : "general",

      barcode,

      price,
      quantity,

      unit: req.body.unit ? String(req.body.unit).trim() : "pcs",
      costPrice,
      reorderLevel,

      description: req.body.description ? String(req.body.description).trim() : "",
      imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : undefined,
    });

    const savedProduct = await newProduct.save();
    return res.status(201).json(savedProduct);
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
      ...(req.query.barcode && { barcode: String(req.query.barcode).trim() }),
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
    return next(errorHandler(403, "You are not allowed to update this product"));
  }

  try {
    const update = {
      name: req.body.name,
      type: req.body.type,
      category: req.body.category,
      imageUrl: req.body.imageUrl,
      barcode: req.body.barcode,

      // UI fields
      unit: req.body.unit,
      description: req.body.description,

      // numeric (cast)
      price: req.body.price,
      quantity: req.body.quantity,
      costPrice: req.body.costPrice,
      reorderLevel: req.body.reorderLevel,
    };

    // Cast numbers safely
    ["price", "quantity", "costPrice", "reorderLevel"].forEach((k) => {
      if (update[k] !== undefined && update[k] !== null && update[k] !== "") {
        update[k] = Number(update[k]);
      } else {
        delete update[k];
      }
    });

    // remove undefined so you don’t overwrite existing values
    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.productId,
      { $set: update },
      { new: true, runValidators: true }
    );

    return res.status(200).json(updatedProduct);
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

export const lowStockProducts = async (req, res, next) => {
  try {
    const DEFAULT_REORDER_LEVEL = 9;

    const products = await Product.find({
      // Only include products where quantity < (reorderLevel or default)
      $expr: {
        $lt: [
          "$quantity",
          { $ifNull: ["$reorderLevel", DEFAULT_REORDER_LEVEL] },
        ],
      },
    }).select("name quantity reorderLevel");

    const reducedProducts = products.reduce((acc, product) => {
      acc[product.name] = product.quantity;
      return acc;
    }, {});

    const lowStockProducts = Object.keys(reducedProducts);

    // Always respond (even if empty) so frontend doesn't hang
    return res.status(200).json({ lowStockProducts });
  } catch (error) {
    return next(errorHandler(500, "Error retrieving products"));
  }
};