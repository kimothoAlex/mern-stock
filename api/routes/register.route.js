import express from "express";
import { verifyToken } from "../utils/verifyUser.js";
import { getOpenRegister, openRegister, closeRegister, dailyRegisterReport } from "../controllers/register.controller.js";

const router = express.Router();

router.get("/open", verifyToken, getOpenRegister);
router.post("/open", verifyToken, openRegister);
router.post("/close", verifyToken, closeRegister);
router.get("/report/daily", verifyToken, dailyRegisterReport);

export default router;