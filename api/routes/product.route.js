import express from "express";
import { verifyToken } from "../utils/verifyUser.js";
import { aggProducts, create, deleteproduct, getproducts, updateproduct } from "../controllers/product.controller.js";

const router = express();

router.post('/create', verifyToken, create);
router.get("/getproducts", getproducts);
router.delete("/delete/:productId",verifyToken, deleteproduct);
router.put("/update/:productId",verifyToken, updateproduct);
router.get("/sales-rank",verifyToken, aggProducts);
export default router;