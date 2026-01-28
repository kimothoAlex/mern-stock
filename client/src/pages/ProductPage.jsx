import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { enqueueSnackbar } from "notistack";
import { Button, Label, Modal, TextInput, Alert } from "flowbite-react";
import  { Link } from "react-router-dom";
import ProductCard from "../components/ProductCard";
import ThermalReceiptModal from "../components/ThermalReceiptModal";

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
  const [receipt, setReceipt] = useState(null);
  const [openReceiptModal, setOpenReceiptModal] = useState(false);

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

        setProduct(data.products[0]);
        setLoading(false);
        setError(false);
      } catch (err) {
        setError(true);
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productSlug]);

  useEffect(() => {
    const fetchRecentProducts = async () => {
      try {
        const res = await fetch(`/api/product/getproducts?limit=3`);
        const data = await res.json();
        if (res.ok) setRecentProducts(data.products);
      } catch (err) {
        console.log(err.message);
      }
    };

    fetchRecentProducts();
  }, []);

  function onCloseSaleModal() {
    setOpenModal(false);
    setQuantity("");
    setFormData({});
    setSaleError(null);
  }

  function onCloseReceipt() {
    setOpenReceiptModal(false);
    setReceipt(null);
    // optional: go back to dashboard after printing/closing
    navigate("/dashboard?tab=products");
  }

  const handleChange = (e) => {
    const val = e.target.value;
    setQuantity(val);

    setFormData((prev) => ({
      ...prev,
      [e.target.id]: Number(val),
    }));
  };

  const handleMakeSale = async () => {
    setSaleError(null);

    if (!quantity || Number(quantity) <= 0) {
      setSaleError("Quantity must be greater than 0");
      return;
    }

    if (product && Number(quantity) > Number(product.quantity)) {
      setSaleError("Insufficient stock");
      return;
    }

    try {
      const response = await fetch(`/api/sale/createsale/${product._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaleError(data?.message || "Sale failed");
        return;
      }

      enqueueSnackbar("Sale Completed Successfully", { variant: "success" });

      // show thermal receipt (80mm + QR)
      setReceipt(data.receipt);
      setOpenModal(false);
      setOpenReceiptModal(true);

      // optional: update UI stock quickly (optimistic)
      setProduct((prev) =>
        prev ? { ...prev, quantity: prev.quantity - Number(quantity) } : prev
      );
    } catch (err) {
      setSaleError(err.message);
    }
  };

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4">Error loading product</div>;

  return (
    <>
  <div className="p-4 max-w-5xl mx-auto">
    {/* PRODUCT DETAILS CARD (NO IMAGE) */}
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                {product?.name || "Product"}
              </h1>

              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                {product?.type && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                    {product.type}
                  </span>
                )}
                {product?.category && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                    {product.category}
                  </span>
                )}
                {product?.barcode && (
                  <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                    Barcode: {product.barcode}
                  </span>
                )}
              </div>
            </div>

            <div className="text-right">
              <p className="text-xs text-gray-500">Selling price</p>
              <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                KES {Number(product?.price || 0).toLocaleString()}
              </p>
            </div>
          </div>

          {/* STOCK INFO */}
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Stock</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                {product?.quantity ?? 0}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Status</p>
              <p
                className={`text-lg font-semibold ${
                  (product?.quantity ?? 0) > 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {(product?.quantity ?? 0) > 0 ? "In Stock" : "Out of Stock"}
              </p>
            </div>

            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-xs text-gray-500">Stock value</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">
                KES{" "}
                {(
                  Number(product?.price || 0) * Number(product?.quantity || 0)
                ).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* ACTIONS */}
        <div className="w-full md:w-[220px] flex flex-col gap-3">
          <Link to="/dashboard?tab=POS">
<Button
disabled={!product || product.quantity <= 0}
className="w-full"
>
Sell Now
</Button>
</Link>

          <Button
            color="light"
            onClick={() => navigate("/dashboard?tab=products")}
            className="w-full"
          >
            Back to Products
          </Button>

          <p className="text-xs text-gray-500 text-center">
            {product?.quantity > 0
              ? "Ready to sell"
              : "Add stock to enable selling"}
          </p>
        </div>
      </div>
    </div>

    {/* SALE MODAL */}
    <Modal show={openModal} size="md" onClose={onCloseSaleModal} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="space-y-5">
          <div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Make Sale
            </h3>
            <p className="text-sm text-gray-500">
              {product?.name} — KES {Number(product?.price || 0).toLocaleString()}
            </p>
          </div>

          <div>
            <div className="mb-2 block">
              <Label htmlFor="quantity" value="Quantity to sell" />
            </div>

            <TextInput
              type="number"
              min={1}
              id="quantity"
              placeholder="Enter quantity"
              value={quantity}
              onChange={handleChange}
              required
            />
          </div>

          {quantity && (
            <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
              <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
                Amount Payable
              </p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                KES{" "}
                {(
                  Number(quantity) * Number(product?.price || 0)
                ).toLocaleString()}
              </p>
            </div>
          )}

          <div className="w-full">
            <Button onClick={handleMakeSale} className="w-full">
              Make Sale
            </Button>
          </div>

          {saleError && <Alert color="failure">{saleError}</Alert>}
        </div>
      </Modal.Body>
    </Modal>

    {/* THERMAL RECEIPT MODAL */}
    <ThermalReceiptModal
      show={openReceiptModal}
      onClose={onCloseReceipt}
      receipt={receipt}
    />

    {/* RECENT PRODUCTS (TEXT ONLY, NO IMAGES) */}
    <div className="mt-8">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Recent products
        </h2>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {recentProducts?.length ? (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {recentProducts.map((p) => (
              <div
                key={p._id}
                className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition"
              >
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white">
                    {p.name}
                  </p>
                  <p className="text-sm text-gray-500">
                    {p.category ? p.category : "—"} • {p.type ? p.type : "—"}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-bold text-gray-900 dark:text-white">
                    KES {Number(p.price || 0).toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-500">
                    Stock: {p.quantity ?? 0}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-4 text-sm text-gray-500">No recent products.</div>
        )}
      </div>
    </div>
  </div>
</>
  );
};

export default ProductPage;
