import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";

import { errorHandler } from "../utils/error.js";

// controllers/product.controller.js

export const create = async (req, res, next) => {
  try {
    const name = String(req.body.name || "").trim();
    const category = String(req.body.category || "").trim();
    const type = req.body.type ? String(req.body.type).trim() : "general";

    if (!name || !category) {
      return next(errorHandler(400, "Please provide product name and category"));
    }

    // ✅ New: optional variants array
    // variants: [{ name, barcode?, price, sellUnit, unitSizeInBase }]
    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];

    // ✅ Decide: base-stock product if variants provided OR explicit isBaseStock flag
    const isBaseStock = Boolean(req.body.isBaseStock) || variants.length > 0;

    // Base unit & base stock only required for base-stock products
    const baseUnit = isBaseStock ? String(req.body.baseUnit || req.body.unit || "").trim() : "";
    const stockBaseQty = isBaseStock ? Number(req.body.stockBaseQty ?? NaN) : null;

    if (isBaseStock) {
      if (!baseUnit) return next(errorHandler(400, "baseUnit is required (e.g. ml, g) for variant products"));

      if (!Number.isFinite(stockBaseQty) || stockBaseQty < 0) {
        return next(errorHandler(400, "stockBaseQty must be a valid number (>= 0)"));
      }

      if (!variants.length) {
        return next(errorHandler(400, "Provide at least 1 variant for a base-stock product"));
      }

      // validate variants
      for (const v of variants) {
        const vName = String(v?.name || "").trim();
        if (!vName) return next(errorHandler(400, "Each variant must have a name"));

        const vPrice = Number(v?.price);
        if (!Number.isFinite(vPrice) || vPrice < 0) return next(errorHandler(400, `Valid price required for variant: ${vName}`));

        const sellUnit = String(v?.sellUnit || "").trim();
        if (!sellUnit) return next(errorHandler(400, `sellUnit required for variant: ${vName}`));

        const unitSizeInBase = Number(v?.unitSizeInBase);
        if (!Number.isFinite(unitSizeInBase) || unitSizeInBase <= 0) {
          return next(errorHandler(400, `unitSizeInBase must be > 0 for variant: ${vName}`));
        }

        const vBarcode = v?.barcode ? String(v.barcode).trim() : "";
        if (vBarcode) {
          const existingVarBarcode = await ProductVariant.findOne({ barcode: vBarcode });
          if (existingVarBarcode) return next(errorHandler(400, `Variant barcode already exists: ${vBarcode}`));
        }
      }
    }

    // slug
    const slug = name
      .split(" ")
      .join("-")
      .toLowerCase()
      .replace(/[^a-zA-Z0-9-]/g, "");

    // Friendly duplicate product-name check
    const existingName = await Product.findOne({ name });
    if (existingName) return next(errorHandler(400, "Product name already exists"));

    // ✅ barcode ONLY for normal products (variants handle their own barcodes)
    const barcode =
      !isBaseStock && req.body.barcode && String(req.body.barcode).trim() !== ""
        ? String(req.body.barcode).trim()
        : undefined;

    if (barcode) {
      const existingBarcode = await Product.findOne({ barcode });
      if (existingBarcode) return next(errorHandler(400, "Barcode already exists"));
    }

    // Numeric fields
    // For base-stock products:
    // - price is optional (usually 0 because you sell variants)
    // - quantity is optional (we use stockBaseQty)
    const price = isBaseStock ? Number(req.body.price ?? 0) : Number(req.body.price);
    const quantity = isBaseStock ? Number(req.body.quantity ?? 0) : Number(req.body.quantity);

    if (!isBaseStock) {
      if (req.body.price === undefined || req.body.quantity === undefined) {
        return next(errorHandler(400, "Please provide all required fields"));
      }
      if (Number.isNaN(price) || price < 0) return next(errorHandler(400, "Valid price is required"));
      if (Number.isNaN(quantity) || quantity < 0) return next(errorHandler(400, "Valid quantity is required"));
    } else {
      if (!Number.isFinite(price) || price < 0) return next(errorHandler(400, "Valid price is required"));
      if (!Number.isFinite(quantity) || quantity < 0) return next(errorHandler(400, "Valid quantity is required"));
    }

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

    // ✅ Create base product
    const newProduct = new Product({
      userId: req.user.id,
      slug,
      name,
      category,
      type,

      // normal product barcode
      barcode,

      // normal stock
      price,
      quantity,

      // base-stock fields
      isBaseStock,
      baseUnit: isBaseStock ? baseUnit : undefined,
      stockBaseQty: isBaseStock ? stockBaseQty : undefined,

      unit: req.body.unit ? String(req.body.unit).trim() : "pcs",
      costPrice,
      reorderLevel,

      description: req.body.description ? String(req.body.description).trim() : "",
      imageUrl: req.body.imageUrl ? String(req.body.imageUrl).trim() : undefined,
    });

    const savedProduct = await newProduct.save();

    // ✅ Create variants if provided
    if (isBaseStock && variants.length) {
      const createdVariants = await ProductVariant.insertMany(
        variants.map((v) => ({
          productId: savedProduct._id,
          name: String(v.name).trim(),
          barcode: v.barcode ? String(v.barcode).trim() : undefined,
          price: Number(v.price),
          sellUnit: String(v.sellUnit).trim(),
          unitSizeInBase: Number(v.unitSizeInBase),
          isActive: v.isActive === undefined ? true : Boolean(v.isActive),
        }))
      );

      return res.status(201).json({
        success: true,
        product: savedProduct,
        variants: createdVariants,
      });
    }

    // normal product response
    return res.status(201).json(savedProduct);
  } catch (error) {
    // handle duplicate key errors nicely
    if (error?.code === 11000) {
      return next(errorHandler(400, "Duplicate value detected (name/slug/barcode)."));
    }
    next(error);
  }
};


export const getproducts = async (req, res, next) => {
  try {
    const startIndex = parseInt(req.query.startIndex) || 0;
    const limit = parseInt(req.query.limit) || 9;
    const sortDirection = req.query.order === "asc" ? 1 : -1;

    const barcode = req.query.barcode ? String(req.query.barcode).trim() : "";
    const searchTerm = req.query.searchTerm ? String(req.query.searchTerm).trim() : "";

    // ✅ BARCODE PATH (variant first, then product)
    if (barcode) {
      const variant = await ProductVariant.findOne({ barcode, isActive: true }).lean();
      if (variant) {
        const baseProduct = await Product.findById(variant.productId).lean();
        return res.status(200).json({
          products: baseProduct ? [baseProduct] : [],
          variants: baseProduct ? [{ ...variant, baseProduct }] : [],
          totalProducts: baseProduct ? 1 : 0,
          matched: baseProduct
            ? { kind: "VARIANT", variantId: String(variant._id), productId: String(baseProduct._id) }
            : null,
        });
      }

      const product = await Product.findOne({ barcode }).lean();
      return res.status(200).json({
        products: product ? [product] : [],
        variants: [],
        totalProducts: product ? 1 : 0,
        matched: product ? { kind: "PRODUCT", productId: String(product._id) } : null,
      });
    }

    // ✅ Normal product filters (same as your current)
    const productFilter = {
      ...(req.query.userId && { userId: req.query.userId }),
      ...(req.query.category && { category: req.query.category }),
      ...(req.query.type && { type: req.query.type }),
      ...(req.query.slug && { slug: req.query.slug }),
      ...(req.query.productId && { _id: req.query.productId }),
      ...(searchTerm && { name: { $regex: searchTerm, $options: "i" } }),
    };

    // 1) Products that match
    const products = await Product.find(productFilter)
      .sort({ updatedAt: sortDirection })
      .skip(startIndex)
      .limit(limit)
      .lean();

    // 2) Variants that match (by name)
    // Optional: also allow filtering variants by category/type by joining to products.
    // We'll do it properly: find variants, then fetch base products, then apply filters.
    let variants = [];
    if (searchTerm) {
      const variantHits = await ProductVariant.find({
        isActive: true,
        name: { $regex: searchTerm, $options: "i" },
      })
        .sort({ updatedAt: sortDirection })
        .limit(limit)
        .lean();

      // Fetch base products for those variants
      const baseIds = [...new Set(variantHits.map((v) => String(v.productId)))];
      const baseProducts = baseIds.length
        ? await Product.find({
            _id: { $in: baseIds },
            ...(req.query.userId && { userId: req.query.userId }),
            ...(req.query.category && { category: req.query.category }),
            ...(req.query.type && { type: req.query.type }),
          }).lean()
        : [];

      const baseMap = new Map(baseProducts.map((p) => [String(p._id), p]));

      // keep only variants whose base product passed filters
      variants = variantHits
        .map((v) => {
          const baseProduct = baseMap.get(String(v.productId));
          if (!baseProduct) return null;
          return { ...v, baseProduct };
        })
        .filter(Boolean);
    }

    const totalProducts = await Product.countDocuments();

    return res.status(200).json({
      products,
      variants, // ✅ now included for search results
      totalProducts,
      matched: null,
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