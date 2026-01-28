import Register from "../models/register.model.js";
import Sale from "../models/sale.model.js";
import { errorHandler } from "../utils/error.js";

// export const getMyOpenRegister = async (req, res, next) => {
//   try {
//     const reg = await Register.findOne({ cashierId: req.user.id, status: "open" });
//     res.status(200).json(reg); // null if none
//   } catch (err) {
//     next(err);
//   }
// };
export const getOpenRegister = async (req, res, next) => {
try {
const register = await Register.findOne({
cashierId: req.user.id,
status: "OPEN",
});


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


// Ensure no other open register exists
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


// initialize tracking fields
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


// Find the cashier's open register
const register = await Register.findOne({
cashierId: req.user.id,
status: "OPEN",
});


if (!register) {
return next(errorHandler(404, "No open register found for this cashier."));
}


// Calculate expected cash (simple version):
// Expected cash = openingFloat + cashSales
// (If you add refunds/expenses later, include them here.)
const openingFloat = Number(register.openingFloat || 0);
const cashSales = Number(register.cashSales || 0);
const expectedCash = openingFloat + cashSales;


const difference = closingCash - expectedCash;


// Close it
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
difference, // + means extra cash, - means short
},
});
} catch (err) {
// If two closes happen at once, one may fail depending on your logic
next(err);
}
};

// controllers/register.controller.js


/**
 * GET /api/register/report/daily?date=YYYY-MM-DD&cashierId=optional
 * - If date not provided: uses today (server time)
 * - If cashierId not provided: uses logged-in user (req.user.id)
 * Returns: daily summary + registers + optional sales totals
 */
export const dailyRegisterReport = async (req, res, next) => {
  try {
    // date=YYYY-MM-DD
    const dateStr = (req.query.date || "").trim();
    const cashierId = (req.query.cashierId || req.user.id).toString();

    // Build day range [start, end)
    const base = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
    if (Number.isNaN(base.getTime())) {
      return next(errorHandler(400, "Invalid date. Use YYYY-MM-DD"));
    }

    // If no date provided, use today's date (UTC day boundary here)
    const start = dateStr
      ? new Date(`${dateStr}T00:00:00.000Z`)
      : new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate(), 0, 0, 0, 0));
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 1);

    // 1) Registers opened that day (for this cashier)
    const registers = await Register.find({
      cashierId,
      openedAt: { $gte: start, $lt: end },
    }).sort({ openedAt: 1 });
    const registerIds = registers.map((r) => r._id);

    // If you want to require at least 1 register:
    // if (!registers.length) return next(errorHandler(404, "No registers found for that day"));

    // 2) Sales totals for that day + cashier (from Sales collection)
    // Assumes Sale has fields: registerId, cashierId, total, payment.method, createdAt/dateSold
    const salesAgg = await Sale.aggregate([
{
$match: {
registerId: { $in: registerIds },
// optionally also restrict by date:
// dateSold: { $gte: start, $lt: end },
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
]);
    const totals = salesAgg?.[0] || {
      salesCount: 0,
      grossSales: 0,
      cashSales: 0,
      mpesaSales: 0,
      discountTotal: 0,
    };

    // 3) Register totals (from Register documents)
    // (If you already update register.grossSales/cashSales/mpesaSales, this helps compare)
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

    // Expected cash for the day (simple model)
    const expectedCash = registerTotals.openingFloat + totals.cashSales;
    const variance = registerTotals.closingCash - expectedCash;

    return res.status(200).json({
      success: true,
      date: start.toISOString().slice(0, 10),
      cashierId,
      totalsFromSales: totals,
      totalsFromRegisters: registerTotals,
      cashReconciliation: {
        expectedCash,
        countedCash: registerTotals.closingCash,
        variance, // + means extra, - means shortage
      },
      registers,
    });
  } catch (err) {
    next(err);
  }
};