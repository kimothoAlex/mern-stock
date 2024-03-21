import express from "express";
import { verifyToken } from "../utils/verifyUser.js";
import { signout, updateUser } from "../controllers/user.controller.js";

const router = express.Router();

router.put("/update/:userId", verifyToken, updateUser);
router.post('/signout', signout);
export default router;
