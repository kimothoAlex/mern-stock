import Product from "../models/product.model.js";

export const create = async (req, res, next) => {
  if (
    !req.body.name ||
    !req.body.type ||
    !req.body.category ||
    !req.body.price ||
    !req.body.quantity
  ) {
    return next(errorHandler(400, "Please provide all required fields"));
  }
  const slug = req.body.name
    .split(" ")
    .join("-")
    .toLowerCase()
    .replace(/[^a-zA-Z0-9-]/g, "");

  const newProduct = new Product({
    ...req.body,
    slug,
    userId: req.user.id,
  });

  try {
    const savedProduct = await newProduct.save();
    res.status(201).json(savedProduct);
  } catch (error) {
    next(error);
  }
};
