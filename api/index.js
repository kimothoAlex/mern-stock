import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import authRoutes from "./routes/auth.route.js";
import userRoutes from './routes/user.route.js';
import productRoutes from "./routes/product.route.js";
import salesRoutes from "./routes/sales.route.js"
import cookieParser from "cookie-parser";
import sseServer from "./controllers/sseServer.js"
import cors from "cors"
import path from "path"
dotenv.config();
const app = express();

app.use(express.json());
app.use(cookieParser());
mongoose
  .connect(process.env.MONGO)
  .then(() => {
    console.log("MongoDb is connected");
  })
  .catch((error) => {
    console.log(error);
  });

  const _dirname = path.resolve();

app.listen(3000, () => {
  console.log("Server is running on port 3000!");
});

app.use(cors({
  origin: 'http://localhost:5173'
}));
app.use("/api/auth", authRoutes);
app.use('/api/user', userRoutes);
app.use("/api/product",productRoutes);
app.use("/api/sale",salesRoutes);
sseServer(app);

app.use(express.static(path.join(_dirname, "/client/dist")));
app.get("*", (req,res)=>{
  res.sendFile(path.join(_dirname, "client", "dist", "index.html"))
});
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(statusCode).json({
    success: false,
    statusCode,
    message,
  });
});
