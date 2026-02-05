import express from "express";
import {
  listVariants,
  createVariant,
  updateVariant,
  deleteVariant,
} from "../controllers/productVariant.controller.js";
import { verifyToken } from "../utils/verifyUser.js"; // use your auth middleware

const router = express.Router();

// List variants for a product (used by ProductPage)
router.get("/list", verifyToken, listVariants);

// Create a variant (admin only)
router.post("/create", verifyToken, createVariant);

// Update a variant (admin only)
router.put("/update/:variantId", verifyToken, updateVariant);



// Delete (admin only)
router.delete("/delete/:variantId", verifyToken, deleteVariant);

export default router;
