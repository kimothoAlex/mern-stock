import mongoose from "mongoose";
import crypto from "crypto";

const saleItemSchema = new mongoose.Schema(
  {
    kind: { type: String, enum: ["PRODUCT", "VARIANT"], required: true },

    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductVariant" }, // optional

    baseQtyDeducted: { type: Number, default: 0 }, // in baseUnit
    baseUnit: { type: String, default: "" }, // ml | g | pcs (optional but nice)

    productName: { type: String, required: true },
    barcode: { type: String, default: "" },

    pricePerUnit: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    totalPrice: { type: Number, required: true },
  },
  { _id: false }
);

const saleSchema = new mongoose.Schema(
  {
    registerId: { type: mongoose.Schema.Types.ObjectId, ref: "Register", required: true },

    // ✅ choose ONE:
    cashierId: { type: String, required: true }, // easiest with req.user.id
    // cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    receiptNo: { type: String, unique: true, required: true },

    items: { type: [saleItemSchema], required: true },

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    payment: {
      method: { type: String, enum: ["CASH", "MPESA"], required: true },
      amountPaid: { type: Number, required: true },
      change: { type: Number, default: 0 },
    },

    dateSold: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

saleSchema.pre("validate", function (next) {
  if (!this.receiptNo) {
    this.receiptNo = `RCT-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
  }
  next();
});

export default mongoose.model("Sale", saleSchema);
