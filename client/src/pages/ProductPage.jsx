import { Spinner } from "flowbite-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { enqueueSnackbar } from "notistack";
import {
  Button,
  Checkbox,
  Label,
  Modal,
  TextInput,
  Alert,
} from "flowbite-react";
import ProductCard from "../components/ProductCard";
import { useNavigate } from "react-router-dom";

const ProductPage = () => {
  const navigate = useNavigate();
  const { productSlug } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [saleError, setSaleError] = useState(null);
  const [product, setProduct] = useState(null);
  const [recentProducts, setRecentProducts] = useState(null);
  const [openModal, setOpenModal] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [formData, setFormData] = useState({});
  console.log(formData);
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

  function onCloseModal() {
    setOpenModal(false);
    setQuantity("");
    setFormData({});
    setSaleError(null);
  }

  const handleChange = (e) => {
    setQuantity(e.target.value);
    setFormData({
      [e.target.id]: e.target.value,
    });
  };

  const handleMakeSale = async () => {
    try {
      const response = await fetch(`/api/sale/createsale/${product._id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success === false) {
        setSaleError(data.message);
        return;
      }

      if (response.ok) {
        enqueueSnackbar("Sale Completed Successfully",{variant:"success"});
        navigate("/dashboard?tab=products");
      }
    } catch (error) {
      console.log(error);
      setSaleError(error.message);
    }
  };

  return (
    <>
      <div className="flex flex-col md:flex-row md:space-x-10 p-4 max-h-[600px]">
        <div className="w-full md:w-1/2">
          <img
            src={product && product.imageUrl}
            alt={product && product.name}
            className="max-h-[500px] w-full object-cover rounded-lg mb-4 md:mb-0"
          />
        </div>
        <div className="flex flex-col justify-between w-full md:w-1/2">
          <div>
            <h1 className="text-2xl font-bold mb-2">
              {product && product.name}
            </h1>
            <div className="flex items-center mb-4">
              <span className="text-lg font-semibold mr-2">
                {`KES ${product && product.price.toLocaleString()}`}
              </span>
              <div className="flex items-center space-x-1">
                <span className="text-gray-500">{product && product.type}</span>
                {product && product.category && (
                  <span className="text-gray-500">
                    ({product && product.category})
                  </span>
                )}
              </div>
            </div>
            <span className="text-lg font-semibold mr-2">
              {`Quantity in stock: ${product && product.quantity}`}
            </span>
          </div>
          <Button type="submit" onClick={() => setOpenModal(true)}>
            Sell Now
          </Button>
        </div>

        <Modal show={openModal} size="md" onClose={onCloseModal} popup>
          <Modal.Header />
          <Modal.Body>
            <div className="space-y-6">
              <h3 className="text-xl font-medium text-gray-900 dark:text-white">
                Make Sale
              </h3>
              <div>
                <div className="mb-2 block">
                  <Label htmlFor="quantity" value="Quantity to sell" />
                </div>
                <TextInput
                  type="number"
                  min={0}
                  id="quantity"
                  placeholder="number of products to be sold"
                  value={quantity}
                  onChange={handleChange}
                  required
                />
              </div>
              {quantity && (
                <div>
                  <div className="mb-2 block">
                    <p className="text-sm font-semibold">Amount Payable</p>
                  </div>
                  <p>{(quantity * product.price).toLocaleString()}</p>
                </div>
              )}

              <div className="w-full">
                <Button onClick={handleMakeSale}>Make Sale</Button>
              </div>
              {saleError && <Alert color="failure">{saleError}</Alert>}
            </div>
          </Modal.Body>
        </Modal>
      </div>
      <div className="flex flex-col justify-center items-center mb-5">
        <h1 className="text-xl mt-5">Recent products</h1>
        <div className="flex flex-wrap gap-5 mt-5 justify-center">
          {recentProducts &&
            recentProducts.map((product) => (
              <ProductCard key={product._id} product={product} />
            ))}
        </div>
      </div>
    </>
  );
};

export default ProductPage;
