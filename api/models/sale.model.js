import mongoose from "mongoose";

const saleItemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
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
cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    receiptNo: { type: String, unique: true, required: true },

    items: { type: [saleItemSchema], required: true },

    subtotal: { type: Number, required: true },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    payment: {
      method: { type: String, enum: ["CASH", "MPESA"], required: true },
      amountPaid: { type: Number, required: true },
      change: { type: Number, default: 0 },
      // mpesaCode: { type: String, default: "" },
    },

    dateSold: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

saleSchema.pre("validate", function (next) {
  if (!this.receiptNo) {
    this.receiptNo = `RCT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
  next();
});

export default mongoose.model("Sale", saleSchema);