import { Spinner } from 'flowbite-react';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from 'flowbite-react';
import ProductCard from '../components/ProductCard';

const ProductPage = () => {
    const { productSlug } = useParams();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [product, setProduct] = useState(null);
    const [recentProducts, setRecentProducts] = useState(null);
  console.log(product);
    useEffect(() => {
      const fetchProduct = async () => {
        try {
          setLoading(true);
          const res = await fetch(`/api/product/getproducts?slug=${productSlug}`);
          const data = await res.json();
          if (!res.ok) {
            setError(true);
            setLoading(false);
            return;
          }
          if (res.ok) {
            setProduct(data.products[0]);
            setLoading(false);
            setError(false);
          }
        } catch (error) {
          setError(true);
          setLoading(false);
        }
      };
      fetchProduct();
    }, [productSlug]);
    useEffect(() => {
        try {
          const fetchRecentProducts = async () => {
            const res = await fetch(`/api/product/getproducts?limit=3`);
            const data = await res.json();
            if (res.ok) {
              setRecentProducts(data.products);
            }
          };
          fetchRecentProducts();
        } catch (error) {
          console.log(error.message);
        }
      }, []);
  return  (
    <>
    <div className="flex flex-col md:flex-row md:space-x-10 p-4 max-h-[600px]">
      <div className="w-full md:w-1/2">
        <img
          src={product && product.imageUrl}
          alt={product&& product.name}
          className="max-h-[500px] w-full object-cover rounded-lg mb-4 md:mb-0"
        />
      </div>
      <div className="flex flex-col justify-between w-full md:w-1/2">
        <div>
          <h1 className="text-2xl font-bold mb-2">{product&&product.name}</h1>
          <div className="flex items-center mb-4">
            <span className="text-lg font-semibold mr-2">
              {`KES ${product&&product.price.toFixed(2)}`}
            </span>
            <div className="flex items-center space-x-1">
              <span className="text-gray-500">{product&&product.type}</span>
              {product&&product.category && <span className="text-gray-500">({product&&product.category})</span>}
            </div>
            
          </div>
          <span className="text-lg font-semibold mr-2">
              {`Quantity in stock: ${product&&product.quantity}`}
            </span>
        </div>
        <Button>Sell Now</Button>
      </div>
      
      
    </div>
    <div className='flex flex-col justify-center items-center mb-5'>
        <h1 className='text-xl mt-5'>Recent products</h1>
        <div className='flex flex-wrap gap-5 mt-5 justify-center'>
          {recentProducts &&
            recentProducts.map((product) => <ProductCard key={product._id} product={product} />)}
        </div>
      </div>
    </>
    
    
  );;
};

export default ProductPage;
