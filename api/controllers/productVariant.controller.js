import Product from "../models/product.model.js";
import ProductVariant from "../models/productVariant.model.js";
import { errorHandler } from "../utils/error.js";


// ============================
// LIST VARIANTS
// GET /api/variant/list?productId=xxx
// ============================
export const listVariants = async (req, res, next) => {
  try {
    const productId = req.query.productId;

    const variants = await ProductVariant.find({
      productId,
      isActive: true,
    }).sort({ createdAt: -1 });

    res.json({ variants });
  } catch (e) {
    next(e);
  }
};


// ============================
// CREATE VARIANT
// ============================
export const createVariant = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin)
      return next(errorHandler(403, "Not allowed"));

    const {
      productId,
      name,
      barcode,
      sellUnit,
      unitSizeInBase,
      price,
      costPrice,
    } = req.body;

    if (!productId || !name || !sellUnit)
      return next(errorHandler(400, "Missing fields"));

    if (unitSizeInBase <= 0)
      return next(errorHandler(400, "unitSizeInBase must be > 0"));

    const product = await Product.findById(productId);
    if (!product)
      return next(errorHandler(404, "Base product not found"));

    // barcode unique
    if (barcode) {
      const exists = await ProductVariant.findOne({ barcode });
      if (exists)
        return next(errorHandler(400, "Barcode already exists"));
    }

    const variant = await ProductVariant.create({
      productId,
      name,
      barcode,
      sellUnit,
      unitSizeInBase,
      price,
      costPrice,
    });

    res.status(201).json(variant);
  } catch (e) {
    next(e);
  }
};


// ============================
// UPDATE VARIANT
// ============================
export const updateVariant = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin)
      return next(errorHandler(403, "Not allowed"));

    const updated = await ProductVariant.findByIdAndUpdate(
      req.params.variantId,
      { $set: req.body },
      { new: true }
    );

    res.json(updated);
  } catch (e) {
    next(e);
  }
};


// ============================
// DELETE
// ============================
export const deleteVariant = async (req, res, next) => {
  try {
    if (!req.user?.isAdmin)
      return next(errorHandler(403, "Not allowed"));

    await ProductVariant.findByIdAndDelete(req.params.variantId);

    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};
