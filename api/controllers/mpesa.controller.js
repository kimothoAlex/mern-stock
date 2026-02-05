import mongoose from "mongoose";
import MpesaSession from "../models/mpesaSession.model.js";
import MpesaTxn from "../models/mpesatxn.model.js";
import { computeDeltas } from "../utils/mpesaDeltas.js";

function escapeCsv(v) {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

const esc = escapeCsv;

export const openSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { openingCashInHand, openingFloat, notes } = req.body;

    const cash = Number(openingCashInHand);
    const flt = Number(openingFloat);

    if (!Number.isFinite(cash) || cash < 0) {
      return res.status(400).json({ message: "Opening cash must be a valid number (>= 0)." });
    }
    if (!Number.isFinite(flt) || flt < 0) {
      return res.status(400).json({ message: "Opening float must be a valid number (>= 0)." });
    }

    const session = await MpesaSession.create({
      cashierId,
      openingCashInHand: cash,
      openingFloat: flt,
      currentCash: cash,
      currentFloat: flt,
      notes,
      status: "OPEN",
    });

    return res.status(201).json(session);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

export const getCurrentSession = async (req, res) => {
  const cashierId = req.user.id;
  const session = await MpesaSession.findOne({ cashierId, status: "OPEN" }).sort({ openedAt: -1 });
  return res.json(session); // null if none
};

/**
 * ✅ Create transaction with balance enforcement:
 * - prevents currentCash < 0
 * - prevents currentFloat < 0
 * - updates balances + creates txn in a DB transaction
 */
export const createTxn = async (req, res) => {
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const performedBy = req.user.id;
      const { type, amount, mpesaCode, phone, note } = req.body;

      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt <= 0) {
        return res.status(400).json({ message: "Amount must be a positive number." });
      }

      const open = await MpesaSession.findOne(
        { cashierId: performedBy, status: "OPEN" },
        null,
        { session: dbSession }
      );

      if (!open) {
        return res.status(400).json({ message: "No open M-Pesa session. Open a session first." });
      }

      const { cashDelta, floatDelta } = computeDeltas({ type, amount: amt });

      // ✅ Atomic: only update if it won't go negative
      const updated = await MpesaSession.findOneAndUpdate(
        {
          _id: open._id,
          status: "OPEN",
          $expr: {
            $and: [
              { $gte: [{ $add: ["$currentCash", cashDelta] }, 0] },
              { $gte: [{ $add: ["$currentFloat", floatDelta] }, 0] },
            ],
          },
        },
        { $inc: { currentCash: cashDelta, currentFloat: floatDelta } },
        { new: true, session: dbSession }
      );

      if (!updated) {
        if (cashDelta < 0) {
          return res.status(400).json({ message: "Insufficient cash in hand for this transaction." });
        }
        if (floatDelta < 0) {
          return res.status(400).json({ message: "Insufficient float for this transaction." });
        }
        return res.status(400).json({ message: "Insufficient balance to complete transaction." });
      }

      const created = await MpesaTxn.create(
        [
          {
            sessionId: open._id,
            type,
            amount: amt,
            cashDelta,
            floatDelta,
            mpesaCode: mpesaCode || undefined,
            phone: phone || undefined,
            note: note || undefined,
            performedBy,
          },
        ],
        { session: dbSession }
      );

      return res.status(201).json({
        txn: created[0],
        balances: { currentCash: updated.currentCash, currentFloat: updated.currentFloat },
      });
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  } finally {
    dbSession.endSession();
  }
};

/**
 * ✅ List transactions:
 * - Defaults to OPEN session transactions
 * - Still supports from/to/type/q filters
 */
export const listTxns = async (req, res) => {
  const cashierId = req.user.id;
  const { from, to, type, q, page = 1, limit = 25, sessionId } = req.query;

  const filter = {};

  // If a sessionId is explicitly provided, use it.
  // Otherwise default to OPEN session for this cashier.
  if (sessionId) {
    filter.sessionId = sessionId;
  } else {
    const open = await MpesaSession.findOne({ cashierId, status: "OPEN" }).select("_id");
    if (open?._id) filter.sessionId = open._id;
  }

  if (type) filter.type = type;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  if (q) {
    const re = new RegExp(q, "i");
    filter.$or = [{ mpesaCode: re }, { phone: re }, { note: re }];
  }

  const skip = (Number(page) - 1) * Number(limit);

  const [items, total] = await Promise.all([
    MpesaTxn.find(filter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    MpesaTxn.countDocuments(filter),
  ]);

  return res.json({
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
};

/**
 * ✅ Reverse transaction AND update balances
 */
export const reverseTxn = async (req, res) => {
  const dbSession = await mongoose.startSession();

  try {
    await dbSession.withTransaction(async () => {
      const performedBy = req.user.id;
      const { note } = req.body;
      const { id } = req.params;

      const original = await MpesaTxn.findById(id).session(dbSession);
      if (!original) return res.status(404).json({ message: "Transaction not found" });

      const sessionDoc = await MpesaSession.findOne({ _id: original.sessionId, status: "OPEN" }).session(dbSession);
      if (!sessionDoc) return res.status(400).json({ message: "Cannot reverse: session is not OPEN." });

      const revCashDelta = -original.cashDelta;
      const revFloatDelta = -original.floatDelta;

      const updated = await MpesaSession.findOneAndUpdate(
        {
          _id: sessionDoc._id,
          status: "OPEN",
          $expr: {
            $and: [
              { $gte: [{ $add: ["$currentCash", revCashDelta] }, 0] },
              { $gte: [{ $add: ["$currentFloat", revFloatDelta] }, 0] },
            ],
          },
        },
        { $inc: { currentCash: revCashDelta, currentFloat: revFloatDelta } },
        { new: true, session: dbSession }
      );

      if (!updated) {
        return res.status(400).json({ message: "Cannot reverse: reversal would cause negative balance." });
      }

      const reversal = await MpesaTxn.create(
        [
          {
            sessionId: original.sessionId,
            type: "REVERSAL",
            amount: original.amount,
            cashDelta: revCashDelta,
            floatDelta: revFloatDelta,
            mpesaCode: undefined,
            phone: original.phone,
            note: note || `Reversal of ${original._id}`,
            performedBy,
            reversalOf: original._id,
          },
        ],
        { session: dbSession }
      );

      return res.status(201).json({
        reversal: reversal[0],
        balances: { currentCash: updated.currentCash, currentFloat: updated.currentFloat },
      });
    });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  } finally {
    dbSession.endSession();
  }
};

export const exportTxnsCsv = async (req, res) => {
  const cashierId = req.user.id;
  const { from, to, type, q, sessionId } = req.query;

  const filter = {};

  if (sessionId) {
    filter.sessionId = sessionId;
  } else {
    const open = await MpesaSession.findOne({ cashierId, status: "OPEN" }).select("_id");
    if (open?._id) filter.sessionId = open._id;
  }

  if (type) filter.type = type;

  if (from || to) {
    filter.createdAt = {};
    if (from) filter.createdAt.$gte = new Date(from);
    if (to) filter.createdAt.$lte = new Date(to);
  }

  if (q) {
    const re = new RegExp(q, "i");
    filter.$or = [{ mpesaCode: re }, { phone: re }, { note: re }];
  }

  const txns = await MpesaTxn.find(filter).sort({ createdAt: -1 }).lean();

  const headers = [
    "dateTime",
    "type",
    "amount",
    "cashDelta",
    "floatDelta",
    "mpesaCode",
    "phone",
    "note",
    "performedBy",
    "sessionId",
    "reversalOf",
  ];

  const lines = [headers.join(",")];

  for (const t of txns) {
    lines.push(
      [
        esc(new Date(t.createdAt).toISOString()),
        esc(t.type),
        esc(t.amount),
        esc(t.cashDelta),
        esc(t.floatDelta),
        esc(t.mpesaCode),
        esc(t.phone),
        esc(t.note),
        esc(t.performedBy),
        esc(t.sessionId),
        esc(t.reversalOf),
      ].join(",")
    );
  }

  const csv = lines.join("\n");
  const filename = `mpesa_txns_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  return res.status(200).send(csv);
};

/**
 * ✅ Export session CSV + reconciliation summary
 */
export const exportSessionCsv = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await MpesaSession.findById(id).lean();
    if (!session) return res.status(404).json({ message: "Session not found" });

    const txns = await MpesaTxn.find({ sessionId: id }).sort({ createdAt: 1 }).lean();

    const totalCashDelta = txns.reduce((sum, t) => sum + Number(t.cashDelta || 0), 0);
    const totalFloatDelta = txns.reduce((sum, t) => sum + Number(t.floatDelta || 0), 0);

    const openingCash = Number(session.openingCashInHand || 0);
    const openingFloat = Number(session.openingFloat || 0);

    const expectedCash = openingCash + totalCashDelta;
    const expectedFloat = openingFloat + totalFloatDelta;

    const closingCash = session.closingCashCounted ?? "";
    const closingFloat = session.closingFloatActual ?? "";

    const cashVariance = closingCash === "" ? "" : Number(closingCash) - expectedCash;
    const floatVariance = closingFloat === "" ? "" : Number(closingFloat) - expectedFloat;

    const headers = [
      "dateTime",
      "type",
      "amount",
      "cashDelta",
      "floatDelta",
      "mpesaCode",
      "phone",
      "note",
    ];

    const rows = [headers.join(",")];

    for (const t of txns) {
      rows.push(
        [
          esc(new Date(t.createdAt).toLocaleString()),
          esc(t.type),
          esc(t.amount),
          esc(t.cashDelta),
          esc(t.floatDelta),
          esc(t.mpesaCode),
          esc(t.phone),
          esc(t.note),
        ].join(",")
      );
    }

    rows.push("");
    rows.push("SUMMARY,,,,,,,");
    rows.push(`Opening Cash In Hand,${esc(openingCash)},,,,,,`);
    rows.push(`Opening Float,${esc(openingFloat)},,,,,,`);
    rows.push(`Total Cash Delta,${esc(totalCashDelta)},,,,,,`);
    rows.push(`Total Float Delta,${esc(totalFloatDelta)},,,,,,`);
    rows.push(`Expected Cash,${esc(expectedCash)},,,,,,`);
    rows.push(`Expected Float,${esc(expectedFloat)},,,,,,`);
    rows.push(`Closing Cash Counted,${esc(closingCash)},,,,,,`);
    rows.push(`Closing Float Actual,${esc(closingFloat)},,,,,,`);
    rows.push(`Cash Variance,${esc(cashVariance)},,,,,,`);
    rows.push(`Float Variance,${esc(floatVariance)},,,,,,`);

    const csv = rows.join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mpesa_session_${id}.csv"`);
    return res.status(200).send(csv);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

export const closeSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { closingCashCounted, closingFloatActual, notes } = req.body;

    const closingCash = Number(closingCashCounted);
    const closingFloat = Number(closingFloatActual);

    if (!Number.isFinite(closingCash) || !Number.isFinite(closingFloat)) {
      return res.status(400).json({ message: "Closing cash and float must be valid numbers." });
    }

    const session = await MpesaSession.findOne({ cashierId, status: "OPEN" });
    if (!session) return res.status(400).json({ message: "No OPEN session found." });

    // Prefer sums for audit, but you can also trust currentCash/currentFloat
    const sums = await MpesaTxn.aggregate([
      { $match: { sessionId: session._id } },
      {
        $group: {
          _id: "$sessionId",
          totalCashDelta: { $sum: "$cashDelta" },
          totalFloatDelta: { $sum: "$floatDelta" },
          txCount: { $sum: 1 },
        },
      },
    ]);

    const totalCashDelta = sums?.[0]?.totalCashDelta ?? 0;
    const totalFloatDelta = sums?.[0]?.totalFloatDelta ?? 0;
    const txCount = sums?.[0]?.txCount ?? 0;

    const openingCash = Number(session.openingCashInHand || 0);
    const openingFloat = Number(session.openingFloat || 0);

    const expectedCash = openingCash + totalCashDelta;
    const expectedFloat = openingFloat + totalFloatDelta;

    const cashVariance = closingCash - expectedCash;
    const floatVariance = closingFloat - expectedFloat;

    session.closingCashCounted = closingCash;
    session.closingFloatActual = closingFloat;
    session.expectedCash = expectedCash;
    session.expectedFloat = expectedFloat;
    session.cashVariance = cashVariance;
    session.floatVariance = floatVariance;
    session.notes = notes ?? session.notes;
    session.status = "CLOSED";
    session.closedAt = new Date();

    await session.save();

    return res.json({
      message: "Session closed",
      session,
      reconciliation: {
        openingCash,
        openingFloat,
        totalCashDelta,
        totalFloatDelta,
        expectedCash,
        expectedFloat,
        closingCash,
        closingFloat,
        cashVariance,
        floatVariance,
        txCount,
        // helpful live balances too:
        currentCash: session.currentCash,
        currentFloat: session.currentFloat,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};
