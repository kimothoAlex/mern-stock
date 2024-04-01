import express from "express";
import { verifyToken } from "../utils/verifyUser.js";
import { create, deleteproduct, getproducts, updateproduct } from "../controllers/product.controller.js";

const router = express();

router.post('/create', verifyToken, create);
router.get("/getproducts", getproducts);
router.delete("/delete/:productId",verifyToken, deleteproduct);
router.put("/update/:productId",verifyToken, updateproduct)
export default router;