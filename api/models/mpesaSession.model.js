import mongoose from "mongoose";

const mpesaSessionSchema = new mongoose.Schema(
  {
    // shopId: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", index: true },
    cashierId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    status: { type: String, enum: ["OPEN", "CLOSED"], default: "OPEN", index: true },

    openedAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },

    openingCashInHand: { type: Number, required: true },
    openingFloat: { type: Number, required: true },

    closingCashCounted: { type: Number },
    closingFloatActual: { type: Number },

    expectedCash: { type: Number },
    expectedFloat: { type: Number },

    cashVariance: { type: Number },
    floatVariance: { type: Number },

    notes: { type: String },
  },
  { timestamps: true }
);

// Only one OPEN session per cashier (and shop if you use shopId)
mpesaSessionSchema.index({ shopId: 1, cashierId: 1, status: 1 }, { unique: true, partialFilterExpression: { status: "OPEN" } });

export default mongoose.model("MpesaSession", mpesaSessionSchema);
