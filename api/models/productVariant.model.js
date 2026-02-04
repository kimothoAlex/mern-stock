import mongoose from "mongoose";

const productVariantSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true, index: true },

    name: { type: String, required: true }, // e.g. Milk 20L
    barcode: { type: String, unique: true, sparse: true, index: true },

    sellUnit: { type: String, required: true }, // L, KG, G, ML
    unitSizeInBase: { type: Number, required: true, min: 1 }, // ml or g or pcs
    price: { type: Number, required: true }, // variant price
    costPrice: { type: Number },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model("ProductVariant", productVariantSchema);
