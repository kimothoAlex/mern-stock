import MpesaSession from "../models/mpesaSession.model.js";
import MpesaTxn from "../models/mpesatxn.model.js";
import { computeDeltas } from "../utils/mpesaDeltas.js";

function escapeCsv(v) {
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export const openSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { shopId, openingCashInHand, openingFloat, notes } = req.body;

    const session = await MpesaSession.create({
      shopId,
      cashierId,
      openingCashInHand: Number(openingCashInHand),
      openingFloat: Number(openingFloat),
      notes,
      status: "OPEN",
    });

    res.status(201).json(session);
  } catch (err) {
    // If unique OPEN session exists, Mongo throws duplicate key error
    res.status(400).json({ message: err.message });
  }
};

export const getCurrentSession = async (req, res) => {
  const cashierId = req.user.id;
  const { shopId } = req.query;
  const session = await MpesaSession.findOne({ shopId, cashierId, status: "OPEN" }).sort({ openedAt: -1 });
  res.json(session);
};

export const createTxn = async (req, res) => {
  try {
    const performedBy = req.user.id;
    const { shopId, type, amount, mpesaCode, phone, note } = req.body;

    const session = await MpesaSession.findOne({ shopId, cashierId: performedBy, status: "OPEN" });
    if (!session) return res.status(400).json({ message: "No open M-Pesa session. Open a session first." });

    const { cashDelta, floatDelta } = computeDeltas({ type, amount });

    const txn = await MpesaTxn.create({
      shopId,
      sessionId: session._id,
      type,
      amount: Number(amount),
      cashDelta,
      floatDelta,
      mpesaCode,
      phone,
      note,
      performedBy,
    });

    res.status(201).json(txn);
  } catch (err) {
    // Duplicate mpesaCode will land here
    res.status(400).json({ message: err.message });
  }
};

export const listTxns = async (req, res) => {
  const { shopId, from, to, type, q, page = 1, limit = 25 } = req.query;

  const filter = { shopId };
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

  res.json({
    items,
    total,
    page: Number(page),
    limit: Number(limit),
    pages: Math.ceil(total / Number(limit)),
  });
};

export const reverseTxn = async (req, res) => {
  try {
    const performedBy = req.user.id;
    const { shopId, note } = req.body;
    const { id } = req.params;

    const original = await MpesaTxn.findOne({ _id: id, shopId });
    if (!original) return res.status(404).json({ message: "Transaction not found" });

    // Ensure you reverse within an open session (recommended)
    const session = await MpesaSession.findOne({ _id: original.sessionId, status: "OPEN" });
    if (!session) return res.status(400).json({ message: "Cannot reverse: session is not OPEN." });

    const reversal = await MpesaTxn.create({
      shopId,
      sessionId: original.sessionId,
      type: "REVERSAL",
      amount: original.amount,
      cashDelta: -original.cashDelta,
      floatDelta: -original.floatDelta,
      mpesaCode: undefined,
      phone: original.phone,
      note: note || `Reversal of ${original._id}`,
      performedBy,
      reversalOf: original._id,
    });

    res.status(201).json(reversal);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
};

export const exportTxnsCsv = async (req, res) => {
  const { shopId, from, to, type, q } = req.query;

  const filter = { shopId };
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
    lines.push([
      escapeCsv(new Date(t.createdAt).toISOString()),
      escapeCsv(t.type),
      escapeCsv(t.amount),
      escapeCsv(t.cashDelta),
      escapeCsv(t.floatDelta),
      escapeCsv(t.mpesaCode),
      escapeCsv(t.phone),
      escapeCsv(t.note),
      escapeCsv(t.performedBy),
      escapeCsv(t.sessionId),
      escapeCsv(t.reversalOf),
    ].join(","));
  }

  const csv = lines.join("\n");
  const filename = `mpesa_txns_${new Date().toISOString().slice(0,10)}.csv`;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.status(200).send(csv);
};
export const exportSessionCsv = async (req, res) => {
  try {
    const { id } = req.params;

    const txns = await MpesaTxn.find({ sessionId: id })
      .sort({ createdAt: 1 })
      .lean();

    if (!txns.length) {
      return res.status(404).json({ message: "No transactions found for this session" });
    }

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

    const esc = (v) => {
      const s = (v ?? "").toString();
      if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
      return s;
    };

    for (const t of txns) {
      rows.push([
        esc(new Date(t.createdAt).toLocaleString()),
        esc(t.type),
        esc(t.amount),
        esc(t.cashDelta),
        esc(t.floatDelta),
        esc(t.mpesaCode),
        esc(t.phone),
        esc(t.note),
      ].join(","));
    }

    const csv = rows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="mpesa_session_${id}.csv"`
    );

    res.send(csv);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
export const closeSession = async (req, res) => {
  try {
    const cashierId = req.user.id;
    const { shopId, closingCashCounted, closingFloatActual, notes } = req.body;

    const session = await MpesaSession.findOne({ shopId, cashierId, status: "OPEN" });
    if (!session) return res.status(400).json({ message: "No OPEN session to close." });

    // Sum deltas for this session
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

    const expectedCash = Number(session.openingCashInHand) + Number(totalCashDelta);
    const expectedFloat = Number(session.openingFloat) + Number(totalFloatDelta);

    const closingCash = Number(closingCashCounted);
    const closingFloat = Number(closingFloatActual);

    if (!Number.isFinite(closingCash) || !Number.isFinite(closingFloat)) {
      return res.status(400).json({ message: "Closing cash/float must be valid numbers." });
    }

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

    res.json({
      session,
      totals: {
        totalCashDelta,
        totalFloatDelta,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
