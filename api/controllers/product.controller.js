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

export const getproducts = async (req, res, next) => {
    try {
      const startIndex = parseInt(req.query.startIndex) || 0;
      const limit = parseInt(req.query.limit) || 9;
      const sortDirection = req.query.order === 'asc' ? 1 : -1;
      const products = await Product.find({
        ...(req.query.userId && { userId: req.query.userId }),
        ...(req.query.category && { category: req.query.category }),
        ...(req.query.slug && { slug: req.query.slug }),
        ...(req.query.productId && { _id: req.query.productId }),
        ...(req.query.searchTerm && {
             title: { $regex: req.query.searchTerm, $options: 'i'  },
        }),
      })
        .sort({ updatedAt: sortDirection })
        .skip(startIndex)
        .limit(limit);
  
      const totalProducts = await Product.countDocuments();

      res.status(200).json({
        products,
        totalProducts
      });
    } catch (error) {
      next(error);
    }
  };
  