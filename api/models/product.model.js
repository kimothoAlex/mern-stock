import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },

    name: { type: String, required: true },
    type: { type: String, required: true },
    category: { type: String, required: true },

    // Selling defaults (optional for base product when using variants)
    price: { type: Number, required: true },
    costPrice: { type: Number },

    // Base stock system (IMPORTANT)
    baseUnit: { type: String, default: "pcs" }, // pcs | ml | g
    stockBaseQty: { type: Number, default: 0 }, // ALWAYS in baseUnit

    // Keep your old fields for backward compatibility (optional)
    unit: { type: String, default: "pcs" }, // display purposes only
    quantity: { type: Number, default: 0 }, // (optional legacy)
    barcode: { type: String, unique: true, sparse: true, index: true }, // (legacy single-SKU)

    reorderLevel: { type: Number, default: 9 },
    description: { type: String, default: "" },

    inStock: { type: Boolean, default: true },
    imageUrl: { type: String, default: "" },

    slug: { type: String, required: true, unique: true },
  },
  { timestamps: true }
);

// Decide inStock based on base stock first
productSchema.pre("save", function (next) {
  const qty = Number.isFinite(this.stockBaseQty) ? this.stockBaseQty : 0;
  this.inStock = qty > 0;
  next();
});

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate() || {};
  const set = update.$set || update;

  if (set.stockBaseQty !== undefined) {
    const qty = Number(set.stockBaseQty);
    if (!Number.isNaN(qty)) set.inStock = qty > 0;
  }

  if (update.$set) update.$set = set;
  else this.setUpdate(set);

  next();
});

export default mongoose.model("Product", productSchema);
