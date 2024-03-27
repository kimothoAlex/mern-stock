import mongoose from "mongoose";
import Product from "./product.model.js";

const saleSchema = new mongoose.Schema({
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product', // Reference the Product model
      required: true,
    },
    quantity: { type: Number, required: true },
    pricePerUnit: { type: Number, required: true }, // Price at the time of sale
    totalPrice: { type: Number }, // Calculated (quantity * pricePerUnit)
    productName: String, // Optional
    dateSold: { type: Date, default: Date.now }, // Date of sale
  },{ timestamps: true });
  
  // Pre-save hook to calculate totalPrice before saving
  saleSchema.pre('save', async function (next) {
    this.totalPrice = this.quantity * this.pricePerUnit;
    next();
  });

  saleSchema.pre('save', async function (next) {
    const productId = this.productId;
    const quantityToSell = this.quantity;
  
    try {
      const product = await Product.findByIdAndUpdate(
        productId,
        { $inc: { quantity: -quantityToSell } }, // Decrement quantity
        { new: true } // Return the updated product
      );
  
      if (!product) {
        throw new Error('Product not found');
      }
  
      next(); // Proceed to the next pre-save hook (if any)
    } catch (err) {
      next(err); // Handle errors
    }
  });
  
  const Sale = mongoose.model('Sale', saleSchema);
   
  export default Sale;