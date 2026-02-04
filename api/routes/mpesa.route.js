import express from "express";
import { verifyToken } from "../utils/verifyUser.js";
import {
  openSession,
  getCurrentSession,
  createTxn,
  listTxns,
  reverseTxn,
  exportTxnsCsv,
  exportSessionCsv,
  closeSession
} from "../controllers/mpesa.controller.js";

const router = express.Router();

router.post("/session/open", verifyToken, openSession);
router.get("/session/current", verifyToken, getCurrentSession);

router.get("/session/:id/export.csv", verifyToken, exportSessionCsv);
router.post("/session/close", verifyToken, closeSession);
router.post("/txns", verifyToken, createTxn);
router.get("/txns", verifyToken, listTxns);
router.post("/txns/:id/reverse", verifyToken, reverseTxn);

// Export button hits this
router.get("/txns/export.csv", verifyToken, exportTxnsCsv);

export default router;
