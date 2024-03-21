import mongoose from "mongoose";

const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true }, // Ensure unique names
    type: { type: String, required: true }, // (e.g., Wine, Spirit)
    category: { type: String, required: true }, // (e.g., Red Wine, Whiskey)
    vintage: Number, // For wines
    yearDistilled: Number, // For spirits
    price: { type: Number, required: true },
    quantity: { type: Number, required: true, default: 0 },
    inStock: { type: Boolean, default: true }, // Track stock availability
    imageUrl: String, // Optional
    description: String,
  },
  { timestamps: true }
);

productSchema.pre("save", async function (next) {
  this.inStock = this.quantity > 0;
  next();
});

const Product = mongoose.model("Product", productSchema);

export default Product;
