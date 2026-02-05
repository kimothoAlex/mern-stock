import mongoose from "mongoose";

const mpesaTxnSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "MpesaSession",
      required: true,
      index: true,
    },

    type: {
      type: String,
      enum: [
        "AGENT_DEPOSIT",        // cash + , float -
        "AGENT_WITHDRAWAL",     // cash - , float +
        "FLOAT_TOPUP_CASH",     // cash - , float +
        "FLOAT_TOPUP_EXTERNAL", // cash 0 , float +
        "FLOAT_CASHOUT",        // cash + , float -
        "REVERSAL",
      ],
      required: true,
      index: true,
    },

    amount: { type: Number, required: true },

    cashDelta: { type: Number, required: true },
    floatDelta: { type: Number, required: true },

    mpesaCode: { type: String, trim: true },
    phone: { type: String, trim: true },
    note: { type: String },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    reversalOf: { type: mongoose.Schema.Types.ObjectId, ref: "MpesaTxn" },
  },
  { timestamps: true }
);

mpesaTxnSchema.index({ mpesaCode: 1 }, { unique: true, sparse: true });

export default mongoose.model("MpesaTxn", mpesaTxnSchema);
