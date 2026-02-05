import mongoose from "mongoose";

const mpesaSessionSchema = new mongoose.Schema(
  {
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },

    openedAt: { type: Date, default: Date.now, index: true },
    closedAt: { type: Date },

    openingCashInHand: { type: Number, required: true },
    openingFloat: { type: Number, required: true },

    // ✅ Running balances (used for enforcing limits)
    currentCash: { type: Number, required: true },
    currentFloat: { type: Number, required: true },

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

// ✅ Only one OPEN session per cashier
mpesaSessionSchema.index(
  { cashierId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } }
);

export default mongoose.model("MpesaSession", mpesaSessionSchema);
