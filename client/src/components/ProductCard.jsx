import React from "react";
import { Card } from 'flowbite-react';
import { Link } from "react-router-dom";

const ProductCard = ({ product }) => {
  return (
    <Card
      className="max-w-sm"
      imgAlt="Apple Watch Series 7 in colors pink, silver, and black"
      imgSrc={product.imageUrl}
    >
      <a href="#">
        <h5 className="text-xl font-semibold tracking-tight text-gray-900 dark:text-white">
          {product.name}
        </h5>
      </a>
     
      <div className="flex items-center justify-between">
        <span className="text-3xl font-bold text-gray-900 dark:text-white">{`KES ${product.price}`}</span>
        <Link
          to={`/product/${product.slug}`}
          className="rounded-lg bg-cyan-700 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-cyan-800 focus:outline-none focus:ring-4 focus:ring-cyan-300 dark:bg-cyan-600 dark:hover:bg-cyan-700 dark:focus:ring-cyan-800"
        >
          View product
        </Link>
      </div>
    </Card>
  );

};

export default ProductCard;
