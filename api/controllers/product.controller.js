// controllers/product.controller.js
import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * Helpers
 */
const slugify = (name) =>
  String(name || "")
    .trim()
    .toLowerCase()
    .split(" ")
    .join("-")
    .replace(/[^a-zA-Z0-9-]/g, "");

const toNum = (v, fallback = undefined) => {
  if (v === undefined || v === null || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const cleanStr = (v) => String(v || "").trim();

const isDupKeyErr = (err) => err?.code === 11000;

/**
 * CREATE PRODUCT (supports variants)
 * - Normal product: { name, category, price, quantity, barcode?, unit? }
 * - Variant/base-stock product:
 *   {
 *     name, category,
 *     baseUnit: "ml"|"g"|"pcs",
 *     stockBaseQty: number,
 *     variants: [{ name, price, unitSizeInBase, sellUnit?, barcode? }]
 *   }
 */
export const create = async (req, res, next) => {
  try {
    const name = cleanStr(req.body.name);
    const category = cleanStr(req.body.category);
    const type = cleanStr(req.body.type) || "general";

    if (!name || !category) {
      return next(errorHandler(400, "Please provide product name and category"));
    }

    const variants = Array.isArray(req.body.variants) ? req.body.variants : [];
    const hasVariants = variants.length > 0;

    const slug = slugify(name);

    // Duplicate name/slug check
    const existingName = await Product.findOne({ name });
    if (existingName) return next(errorHandler(400, "Product name already exists"));

    // ✅ If variants exist, enforce base stock fields
    let baseUnit;
    let stockBaseQty;

    if (hasVariants) {
      baseUnit = cleanStr(req.body.baseUnit || req.body.unit);
      stockBaseQty = toNum(req.body.stockBaseQty, NaN);

      if (!baseUnit) return next(errorHandler(400, "baseUnit is required (ml/g/pcs) for variant products"));
      if (!Number.isFinite(stockBaseQty) || stockBaseQty < 0) {
        return next(errorHandler(400, "stockBaseQty must be a valid number (>= 0)"));
      }

      // Validate variants & barcode uniqueness
      for (const v of variants) {
        const vName = cleanStr(v?.name);
        const vPrice = toNum(v?.price, NaN);
        const unitSizeInBase = toNum(v?.unitSizeInBase, NaN);
        const sellUnit = cleanStr(v?.sellUnit);

        if (!vName) return next(errorHandler(400, "Each variant must have a name"));
        if (!Number.isFinite(vPrice) || vPrice < 0) {
          return next(errorHandler(400, `Valid price required for variant: ${vName}`));
        }
        if (!Number.isFinite(unitSizeInBase) || unitSizeInBase <= 0) {
          return next(errorHandler(400, `unitSizeInBase must be > 0 for variant: ${vName}`));
        }
        // sellUnit is optional in DB, but if you want it required in UI, keep this check:
        if (!sellUnit) return next(errorHandler(400, `sellUnit required for variant: ${vName}`));

        const vBarcode = cleanStr(v?.barcode);
        if (vBarcode) {
          const exists = await ProductVariant.findOne({ barcode: vBarcode });
          if (exists) return next(errorHandler(400, `Variant barcode already exists: ${vBarcode}`));
        }
      }
    }

    // ✅ Normal product barcode only (variants use their own)
    const barcode = !hasVariants && cleanStr(req.body.barcode) ? cleanStr(req.body.barcode) : undefined;
    if (barcode) {
      const existingBarcode = await Product.findOne({ barcode });
      if (existingBarcode) return next(errorHandler(400, "Barcode already exists"));
    }

    // Normal product numeric requirements
    const price = toNum(req.body.price, NaN);
    const quantity = toNum(req.body.quantity, NaN);

    if (!hasVariants) {
      if (req.body.price === undefined || req.body.quantity === undefined) {
        return next(errorHandler(400, "Please provide all required fields"));
      }
      if (!Number.isFinite(price) || price < 0) return next(errorHandler(400, "Valid price is required"));
      if (!Number.isFinite(quantity) || quantity < 0) return next(errorHandler(400, "Valid quantity is required"));
    }

    const costPrice = toNum(req.body.costPrice, undefined);
    const reorderLevel = toNum(req.body.reorderLevel, undefined);
    if (costPrice !== undefined && costPrice < 0) return next(errorHandler(400, "Valid cost price is required"));
    if (reorderLevel !== undefined && reorderLevel < 0) return next(errorHandler(400, "Valid reorder level is required"));

    // ✅ Create product
    const product = await Product.create({
      userId: req.user.id,
      slug,
      name,
      category,
      type,

      // selling defaults (normal products)
      price: hasVariants ? 0 : price,
      quantity: hasVariants ? 0 : quantity,
      barcode,

      // base-stock fields for variants
      hasVariants,
      baseUnit: hasVariants ? baseUnit : undefined,
      stockBaseQty: hasVariants ? stockBaseQty : undefined,

      unit: cleanStr(req.body.unit) || "pcs",
      costPrice,
      reorderLevel,
      description: cleanStr(req.body.description),
      imageUrl: cleanStr(req.body.imageUrl) || "",
    });

    // ✅ Create variants as separate documents
    let createdVariants = [];
    if (hasVariants) {
      createdVariants = await ProductVariant.insertMany(
        variants.map((v) => ({
          productId: product._id,
          name: cleanStr(v.name),
          barcode: cleanStr(v.barcode) || undefined,
          price: toNum(v.price, 0),
          sellUnit: cleanStr(v.sellUnit),
          unitSizeInBase: toNum(v.unitSizeInBase, 1),
          isActive: v.isActive === undefined ? true : Boolean(v.isActive),
        }))
      );
    }

    return res.status(201).json({
      success: true,
      product,
      variants: createdVariants,
    });
  } catch (err) {
    if (isDupKeyErr(err)) {
      return next(errorHandler(400, "Duplicate value detected (name/slug/barcode)."));
    }
    next(err);
  }
};

/**
 * GET PRODUCTS
 * Supports:
 * - barcode: tries variant barcode first, then product barcode
 * - searchTerm: returns matching products + matching variants (with baseProduct attached)
 */
export const getproducts = async (req, res, next) => {
  try {
    const startIndex = parseInt(req.query.startIndex, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 9;
    const sortDirection = req.query.order === "asc" ? 1 : -1;

    const barcode = req.query.barcode ? cleanStr(req.query.barcode) : "";
    const searchTerm = req.query.searchTerm ? cleanStr(req.query.searchTerm) : "";

    // ✅ BARCODE: variant first
    if (barcode) {
      const variant = await ProductVariant.findOne({ barcode, isActive: true }).lean();

      if (variant) {
        const baseProduct = await Product.findById(variant.productId).lean();

        // If base product missing or not in variants mode, treat as not found
        if (!baseProduct || !baseProduct.hasVariants) {
          return res.status(200).json({
            products: [],
            variants: [],
            totalProducts: 0,
            matched: null,
          });
        }

        return res.status(200).json({
          products: [baseProduct],
          variants: [{ ...variant, baseProduct }],
          totalProducts: 1,
          matched: { kind: "VARIANT", variantId: String(variant._id), productId: String(baseProduct._id) },
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

    // ✅ Product filter
    const productFilter = {
      ...(req.query.userId && { userId: req.query.userId }),
      ...(req.query.category && { category: req.query.category }),
      ...(req.query.type && { type: req.query.type }),
      ...(req.query.slug && { slug: req.query.slug }),
      ...(req.query.productId && { _id: req.query.productId }),
      ...(searchTerm && { name: { $regex: searchTerm, $options: "i" } }),
    };

    // 1) Products that match (base products)
    const products = await Product.find(productFilter)
      .sort({ updatedAt: sortDirection })
      .skip(startIndex)
      .limit(limit)
      .lean();

    // Collect base IDs that matched product-name search
    const matchedProductIds = products.map((p) => String(p._id));

    // 2) Variants matching by variant name (direct hits)
    let variantHits = [];
    if (searchTerm) {
      variantHits = await ProductVariant.find({
        isActive: true,
        name: { $regex: searchTerm, $options: "i" },
      })
        .sort({ updatedAt: sortDirection })
        .limit(limit)
        .lean();
    }

    // 3) ALSO include variants for base-products that matched by name (this is the missing piece)
    let variantsOfMatchedProducts = [];
    if (searchTerm && matchedProductIds.length) {
      variantsOfMatchedProducts = await ProductVariant.find({
        isActive: true,
        productId: { $in: matchedProductIds },
      })
        .sort({ updatedAt: sortDirection })
        .lean();
    }

    // Merge & dedupe variants
    const mergedVariantMap = new Map();
    [...variantHits, ...variantsOfMatchedProducts].forEach((v) => {
      mergedVariantMap.set(String(v._id), v);
    });
    const mergedVariants = [...mergedVariantMap.values()];

    // Fetch base products for variants (and apply same category/type/user filters)
    let variants = [];
    if (mergedVariants.length) {
      const baseIds = [...new Set(mergedVariants.map((v) => String(v.productId)))];

      const baseProducts = await Product.find({
        _id: { $in: baseIds },
        hasVariants: true, // ✅ only true variant-mode products
        ...(req.query.userId && { userId: req.query.userId }),
        ...(req.query.category && { category: req.query.category }),
        ...(req.query.type && { type: req.query.type }),
      }).lean();

      const baseMap = new Map(baseProducts.map((p) => [String(p._id), p]));

      variants = mergedVariants
        .map((v) => {
          const baseProduct = baseMap.get(String(v.productId));
          if (!baseProduct) return null;
          return { ...v, baseProduct };
        })
        .filter(Boolean)
        .slice(0, limit); // keep result size reasonable
    }

    // Better: count filtered products (not all products)
    const totalProducts = await Product.countDocuments(productFilter);

    return res.status(200).json({
      products,
      variants,
      totalProducts,
      matched: null,
    });
  } catch (err) {
    next(err);
  }
};


export const deleteproduct = async (req, res, next) => {
  if (!req.user.isAdmin) {
    return next(errorHandler(403, "You are not allowed to delete this product"));
  }
  try {
    await Product.findByIdAndDelete(req.params.productId);
    // optional: also delete variants
    await ProductVariant.deleteMany({ productId: req.params.productId });
    return res.status(200).json("The product has been deleted");
  } catch (err) {
    next(err);
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

      // only safe for non-variant products
      barcode: req.body.barcode,
      unit: req.body.unit,
      description: req.body.description,

      price: req.body.price,
      quantity: req.body.quantity,
      costPrice: req.body.costPrice,
      reorderLevel: req.body.reorderLevel,
    };

    // cast numbers safely
    ["price", "quantity", "costPrice", "reorderLevel"].forEach((k) => {
      if (update[k] !== undefined && update[k] !== null && update[k] !== "") {
        update[k] = Number(update[k]);
      } else {
        delete update[k];
      }
    });

    Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);

    // Prevent overwriting barcode/price/quantity for variant products unless you decide to allow it
    const product = await Product.findById(req.params.productId).lean();
    if (!product) return next(errorHandler(404, "Product not found"));

    if (product.hasVariants) {
      delete update.barcode;
      delete update.price;
      delete update.quantity;
      delete update.unit;
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      req.params.productId,
      { $set: update },
      { new: true, runValidators: true }
    );

    return res.status(200).json(updatedProduct);
  } catch (err) {
    if (isDupKeyErr(err)) {
      return next(errorHandler(400, "Duplicate value detected (name/slug/barcode)."));
    }
    next(err);
  }
};

/**
 * Aggregation: product sales ranks (still works for base products)
 * NOTE: If you want variant-level ranking, tell me and I’ll add it too.
 */
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
          productName: "$name",
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
      Product.aggregate([...basePipeline, { $sort: { totalSales: -1 } }, { $limit: limit }]),
      Product.aggregate([...basePipeline, { $sort: { totalSales: 1 } }, { $limit: limit }]),
    ]);

    return res.status(200).json({ topSold, leastSold });
  } catch (err) {
    next(errorHandler(500, "Error retrieving sales ranks"));
  }
};

export const lowStockProducts = async (req, res, next) => {
  try {
    const DEFAULT_REORDER_LEVEL = 9;

    // ✅ if product.hasVariants => compare stockBaseQty vs reorderLevel
    // ✅ else compare quantity vs reorderLevel
    const products = await Product.find({
      $expr: {
        $lt: [
          { $cond: [{ $eq: ["$hasVariants", true] }, "$stockBaseQty", "$quantity"] },
          { $ifNull: ["$reorderLevel", DEFAULT_REORDER_LEVEL] },
        ],
      },
    }).select("name quantity stockBaseQty baseUnit reorderLevel hasVariants");

    const reducedProducts = products.reduce((acc, p) => {
      acc[p.name] = p.hasVariants ? `${p.stockBaseQty} ${p.baseUnit}` : p.quantity;
      return acc;
    }, {});

    const lowStockProducts = Object.keys(reducedProducts);

    return res.status(200).json({ lowStockProducts, details: reducedProducts });
  } catch (err) {
    return next(errorHandler(500, "Error retrieving products"));
  }
};
