import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },

    name: { type: String, required: true },
    type: { type: String, required: true, default: "general" },
    category: { type: String, required: true },

    // Normal product fields (used when hasVariants=false)
    price: { type: Number, required: true, default: 0 },
    costPrice: { type: Number },

    // ✅ Shared stock system (used when hasVariants=true)
    baseUnit: { type: String, enum: ["pcs", "ml", "g"], default: "pcs" },
    stockBaseQty: { type: Number, default: 0 },

    // ✅ Mode flag
    hasVariants: { type: Boolean, default: false, index: true },

    // Legacy fields for non-variant products
    unit: { type: String, default: "pcs" },
    quantity: { type: Number, default: 0 },
    barcode: { type: String, unique: true, sparse: true, index: true },

    reorderLevel: { type: Number, default: 9 },
    description: { type: String, default: "" },

    inStock: { type: Boolean, default: true },
    imageUrl: { type: String, default: "" },

    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

// ✅ Decide inStock based on mode
productSchema.pre("save", function (next) {
  const qty = this.hasVariants ? Number(this.stockBaseQty || 0) : Number(this.quantity || 0);
  this.inStock = qty > 0;
  next();
});

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const set = update.$set || update;

  const hasVariants = set.hasVariants === true;

  if (hasVariants || set.stockBaseQty !== undefined) {
    const qty = Number(set.stockBaseQty ?? 0);
    if (!Number.isNaN(qty)) set.inStock = qty > 0;
  } else if (set.quantity !== undefined) {
    const qty = Number(set.quantity ?? 0);
    if (!Number.isNaN(qty)) set.inStock = qty > 0;
  }

  if (update.$set) update.$set = set;
  else this.setUpdate(set);

  next();
});

export default mongoose.model("Product", productSchema);
