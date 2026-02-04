export function computeDeltas({ type, amount }) {
  const X = Number(amount);
  if (!Number.isFinite(X) || X <= 0) throw new Error("Amount must be a positive number");

  switch (type) {
    case "AGENT_DEPOSIT":        return { cashDelta: +X, floatDelta: -X };
    case "AGENT_WITHDRAWAL":     return { cashDelta: -X, floatDelta: +X };
    case "FLOAT_TOPUP_CASH":     return { cashDelta: -X, floatDelta: +X };
    case "FLOAT_TOPUP_EXTERNAL": return { cashDelta:  0, floatDelta: +X };
    case "FLOAT_CASHOUT":        return { cashDelta: +X, floatDelta: -X };
    default:
      throw new Error("Unsupported transaction type for delta computation");
  }
}
