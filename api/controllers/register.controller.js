// controllers/register.controller.js
import Register from "../models/register.model.js";
import Sale from "../models/sale.model.js";
import { errorHandler } from "../utils/error.js";

/**
 * GET /api/register/open
 * Returns the currently OPEN register for the logged-in cashier (or null).
 */
export const getOpenRegister = async (req, res, next) => {
  try {
    const register = await Register.findOne({
      cashierId: req.user.id,
      status: "OPEN",
    }).lean();

    return res.status(200).json(register || null);
  } catch (err) {
    next(err);
  }
};

export const openRegister = async (req, res, next) => {
  try {
    const openingFloat = Number(req.body.openingFloat || 0);

    if (!Number.isFinite(openingFloat) || openingFloat < 0) {
      return next(errorHandler(400, "openingFloat must be a valid number"));
    }

    const existing = await Register.findOne({
      cashierId: req.user.id,
      status: "OPEN",
    });

    if (existing) {
      return next(errorHandler(400, "Register already open for this cashier."));
    }

    const register = await Register.create({
      cashierId: req.user.id,
      openedBy: req.user.id,
      openingFloat,
      status: "OPEN",
      salesCount: 0,
      grossSales: 0,
      cashSales: 0,
      mpesaSales: 0,
    });

    return res.status(201).json(register);
  } catch (err) {
    next(err);
  }
};

export const closeRegister = async (req, res, next) => {
  try {
    const closingCash = Number(req.body.closingCash ?? NaN);
    const notes = (req.body.notes || "").trim();

    if (!Number.isFinite(closingCash) || closingCash < 0) {
      return next(errorHandler(400, "closingCash must be a valid number (>= 0)."));
    }

    const register = await Register.findOne({
      cashierId: req.user.id,
      status: "OPEN",
    });

    if (!register) {
      return next(errorHandler(404, "No open register found for this cashier."));
    }

    const openingFloat = Number(register.openingFloat || 0);
    const cashSales = Number(register.cashSales || 0);
    const expectedCash = openingFloat + cashSales;
    const difference = closingCash - expectedCash;

    register.status = "CLOSED";
    register.closedAt = new Date();
    register.closingCash = closingCash;
    if (notes) register.notes = notes;

    await register.save();

    return res.status(200).json({
      success: true,
      register,
      summary: {
        openingFloat,
        cashSales,
        mpesaSales: Number(register.mpesaSales || 0),
        grossSales: Number(register.grossSales || 0),
        salesCount: Number(register.salesCount || 0),
        expectedCash,
        closingCash,
        difference,
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/register/report/daily?date=YYYY-MM-DD&cashierId=optional
 * Returns:
 * - daily totals from Sales (filtered by dateSold within that day)
 * - totals from Register docs
 * - cash reconciliation
 * - registers list opened that day
 * - defaultRegisterId (OPEN first if present, else latest)
 */
export const dailyRegisterReport = async (req, res, next) => {
  try {
    const dateStr = (req.query.date || "").trim();
    const cashierId = (req.query.cashierId || req.user.id).toString();

    const base = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(base.getTime())) {
      return next(errorHandler(400, "Invalid date. Use YYYY-MM-DD"));
    }

    const start = dateStr
      ? new Date(`${dateStr}T00:00:00.000Z`)
      : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));

    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    // Registers opened that day (by openedAt)
    const registers = await Register.find({
      cashierId,
      openedAt: { $gte: start, $lt: end },
    })
      .sort({ openedAt: 1 })
      .lean();

    const registerIds = registers.map((r) => r._id);

    // Sales totals for that day (by dateSold) across those registers
    const salesAgg = registerIds.length
      ? await Sale.aggregate([
          {
            $match: {
              registerId: { $in: registerIds },
              dateSold: { $gte: start, $lt: end },
            },
          },
          {
            $group: {
              _id: null,
              salesCount: { $sum: 1 },
              grossSales: { $sum: "$total" },
              cashSales: { $sum: { $cond: [{ $eq: ["$payment.method", "CASH"] }, "$total", 0] } },
              mpesaSales: { $sum: { $cond: [{ $eq: ["$payment.method", "MPESA"] }, "$total", 0] } },
              discountTotal: { $sum: "$discount" },
            },
          },
        ])
      : [];

    const totals = salesAgg?.[0] || {
      salesCount: 0,
      grossSales: 0,
      cashSales: 0,
      mpesaSales: 0,
      discountTotal: 0,
    };

    const registerTotals = registers.reduce(
      (acc, r) => {
        acc.openingFloat += Number(r.openingFloat || 0);
        acc.closingCash += Number(r.closingCash || 0);
        acc.salesCount += Number(r.salesCount || 0);
        acc.grossSales += Number(r.grossSales || 0);
        acc.cashSales += Number(r.cashSales || 0);
        acc.mpesaSales += Number(r.mpesaSales || 0);
        return acc;
      },
      {
        openingFloat: 0,
        closingCash: 0,
        salesCount: 0,
        grossSales: 0,
        cashSales: 0,
        mpesaSales: 0,
      }
    );

    const expectedCash = registerTotals.openingFloat + totals.cashSales;
    const variance = registerTotals.closingCash - expectedCash;

    const openReg = registers.find((r) => r.status === "OPEN");
    const defaultRegisterId = openReg?._id || registers[registers.length - 1]?._id || null;

    return res.status(200).json({
      success: true,
      date: start.toISOString().slice(0, 10),
      cashierId,
      defaultRegisterId,
      totalsFromSales: totals,
      totalsFromRegisters: registerTotals,
      cashReconciliation: {
        expectedCash,
        countedCash: registerTotals.closingCash,
        variance,
      },
      registers,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/register/report/register?registerId=xxxx
 * Returns:
 * - register doc
 * - sales list for that register
 * - totals computed from Sales
 * - qtySold (optional convenience)
 */
export const registerReport = async (req, res, next) => {
  try {
    const registerId = (req.query.registerId || "").trim();
    if (!registerId) return next(errorHandler(400, "registerId is required"));

    const register = await Register.findById(registerId).lean();
    if (!register) return next(errorHandler(404, "Register not found"));

    // Optional: restrict to the same cashier unless admin
    // if (register.cashierId.toString() !== req.user.id && !req.user.isAdmin) {
    //   return next(errorHandler(403, "Not allowed"));
    // }

    const sales = await Sale.find({ registerId: register._id }).sort({ dateSold: 1 }).lean();

    const totalsAgg = await Sale.aggregate([
      { $match: { registerId: register._id } },
      {
        $group: {
          _id: null,
          salesCount: { $sum: 1 },
          grossSales: { $sum: "$total" },
          cashSales: { $sum: { $cond: [{ $eq: ["$payment.method", "CASH"] }, "$total", 0] } },
          mpesaSales: { $sum: { $cond: [{ $eq: ["$payment.method", "MPESA"] }, "$total", 0] } },
          discountTotal: { $sum: "$discount" },
        },
      },
    ]);

    const totalsFromSales = totalsAgg?.[0] || {
      salesCount: 0,
      grossSales: 0,
      cashSales: 0,
      mpesaSales: 0,
      discountTotal: 0,
    };

    const qtySold = sales.reduce(
      (acc, s) => acc + (s.items || []).reduce((a, it) => a + Number(it.quantity || 0), 0),
      0
    );

    return res.status(200).json({
      success: true,
      register,
      totalsFromSales,
      qtySold,
      sales,
      totalsFromRegisterDoc: {
        salesCount: Number(register.salesCount || 0),
        grossSales: Number(register.grossSales || 0),
        cashSales: Number(register.cashSales || 0),
        mpesaSales: Number(register.mpesaSales || 0),
      },
    });
  } catch (err) {
    next(err);
  }
};