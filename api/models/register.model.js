import mongoose from "mongoose";

const registerSchema = new mongoose.Schema(
  {
    // Which cashier owns this register session
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // Who opened it (usually same as cashier, but kept for audit)
    openedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    status: {
      type: String,
      enum: ["OPEN", "CLOSED"],
      default: "OPEN",
      index: true,
    },

    openedAt: { type: Date, default: Date.now },
    closedAt: { type: Date },

    openingFloat: { type: Number, default: 0 },
    closingCash: { type: Number, default: 0 },

    // ✅ Running totals (updated during checkout)
    salesCount: { type: Number, default: 0 },
    grossSales: { type: Number, default: 0 },
    cashSales: { type: Number, default: 0 },
    mpesaSales: { type: Number, default: 0 },

    notes: { type: String },
  },
  { timestamps: true }
);

// ✅ Enforce one OPEN register per cashier
registerSchema.index(
  { cashierId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "OPEN" } }
);

const Register = mongoose.model("Register", registerSchema);
export default Register;