import express from "express"
import { createSale, deleteSale, getSales, totalSales } from "../controllers/sale.controller.js";
import { verifyToken } from "../utils/verifyUser.js";

const router = express.Router();

router.post("/createsale/:productId",createSale);
router.get("/getsales",verifyToken,getSales);
router.delete("/deletesale/:saleId",verifyToken,deleteSale);
router.get('/total/:period', verifyToken, totalSales);
export default router;