import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { enqueueSnackbar } from "notistack";
import { Button, Label, Modal, TextInput, Alert, Spinner, Table } from "flowbite-react";
import ThermalReceiptModal from "../components/ThermalReceiptModal";

const safeJson = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const ProductPage = () => {
  const navigate = useNavigate();
  const { productSlug } = useParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [saleError, setSaleError] = useState(null);
  const [product, setProduct] = useState(null);
  const [recentProducts, setRecentProducts] = useState(null);

  // ✅ variants
  const [variantsLoading, setVariantsLoading] = useState(false);
  const [variants, setVariants] = useState([]);

  const isVariantProduct = useMemo(() => Boolean(product?.hasVariants), [product]);


  const [openModal, setOpenModal] = useState(false);
  const [quantity, setQuantity] = useState("");

  const [formData, setFormData] = useState({});
  const [receipt, setReceipt] = useState(null);
  const [openReceiptModal, setOpenReceiptModal] = useState(false);

  // -------- load product ----------
  useEffect(() => {
    const fetchProduct = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/product/getproducts?slug=${encodeURIComponent(productSlug)}&limit=1`);
        const data = await safeJson(res);

        if (!res.ok) {
          setError(true);
          setLoading(false);
          return;
        }

        const p = data?.products?.[0];
        setProduct(p || null);
        setLoading(false);
        setError(false);
      } catch (err) {
        setError(true);
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productSlug]);

  // -------- load variants if needed ----------
  useEffect(() => {
    const fetchVariants = async () => {
      if (!product?._id) return;

      if (!product?.hasVariants) {
        setVariants([]);
        return;
      }

      try {
        setVariantsLoading(true);
        const res = await fetch(`/api/variant/list?productId=${encodeURIComponent(product._id)}`);
        const data = await safeJson(res);
        if (!res.ok) throw new Error(data?.message || "Failed to load variants");

        setVariants(Array.isArray(data?.variants) ? data.variants : []);
      } catch (e) {
        setVariants([]);
      } finally {
        setVariantsLoading(false);
      }
    };

    fetchVariants();
  }, [product]);

  // -------- recent products ----------
  useEffect(() => {
    const fetchRecentProducts = async () => {
      try {
        const res = await fetch(`/api/product/getproducts?limit=3`);
        const data = await safeJson(res);
        if (res.ok) setRecentProducts(data?.products || []);
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

  // ✅ only for normal products
  const handleMakeSale = async () => {
    setSaleError(null);

    if (!product?._id) return setSaleError("Product not loaded");
    if (product?.hasVariants) {
      setSaleError("This product is sold using variants. Use POS to select a variant.");
      return;
    }

    if (!quantity || Number(quantity) <= 0) {
      setSaleError("Quantity must be greater than 0");
      return;
    }

    if (Number(quantity) > Number(product.quantity || 0)) {
      setSaleError("Insufficient stock");
      return;
    }

    try {
      const response = await fetch(`/api/sale/createsale/${product._id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await safeJson(response);

      if (!response.ok) {
        setSaleError(data?.message || "Sale failed");
        return;
      }

      enqueueSnackbar("Sale Completed Successfully", { variant: "success" });

      setReceipt(data.receipt);
      setOpenModal(false);
      setOpenReceiptModal(true);

      // optimistic stock update (legacy qty)
      setProduct((prev) =>
        prev ? { ...prev, quantity: Number(prev.quantity || 0) - Number(quantity) } : prev
      );
    } catch (err) {
      setSaleError(err.message);
    }
  };

  const stockLabel = useMemo(() => {
    if (!product) return "";
    if (product.hasVariants) {
      const qty = Number(product.stockBaseQty || 0);
      const u = product.baseUnit || "ml";
      return `${qty.toLocaleString()} ${u}`;
    }
    return `${Number(product.quantity || 0).toLocaleString()} ${product.unit || "pcs"}`;
  }, [product]);

  const sellEnabled = useMemo(() => {
    if (!product) return false;
    if (product.hasVariants) return Number(product.stockBaseQty || 0) > 0;
    return Number(product.quantity || 0) > 0;
  }, [product]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (error) return <div className="p-4">Error loading product</div>;

  return (
    <>
      <div className="p-4 max-w-5xl mx-auto">
        {/* PRODUCT DETAILS CARD */}
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

                    {/* normal barcode only */}
                    {!product?.hasVariants && product?.barcode && (
                      <span className="px-2 py-1 rounded-full bg-gray-100 dark:bg-gray-700">
                        Barcode: {product.barcode}
                      </span>
                    )}

                    {/* badge for variant products */}
                    {product?.hasVariants && (
                      <span className="px-2 py-1 rounded-full bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-100">
                        Variant product • base unit: {product.baseUnit || "ml"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-gray-500">Selling price</p>
                  <p className="text-2xl font-extrabold text-gray-900 dark:text-white">
                    KES {Number(product?.price || 0).toLocaleString()}
                  </p>
                  {product?.hasVariants && (
                    <p className="text-xs text-gray-500 mt-1">
                      (Variants have their own prices)
                    </p>
                  )}
                </div>
              </div>

              {/* STOCK INFO */}
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Stock</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {stockLabel}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Status</p>
                  <p
                    className={`text-lg font-semibold ${
                      sellEnabled ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {sellEnabled ? "In Stock" : "Out of Stock"}
                  </p>
                </div>

                <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                  <p className="text-xs text-gray-500">Stock value</p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {product?.hasVariants ? (
                      <>—</>
                    ) : (
                      <>
                        KES{" "}
                        {(Number(product?.price || 0) * Number(product?.quantity || 0)).toLocaleString()}
                      </>
                    )}
                  </p>
                  {product?.hasVariants && (
                    <p className="text-xs text-gray-500 mt-1">
                      For base-stock, value depends on variant pricing.
                    </p>
                  )}
                </div>
              </div>

              {/* ✅ VARIANTS LIST */}
              {product?.hasVariants && (
                <div className="mt-6 rounded-2xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Variants
                      </h2>
                      <p className="text-xs text-gray-500">
                        Selling units are stored in <b>{product.baseUnit}</b>. Example: 500 {product.baseUnit}, 1000 {product.baseUnit}
                      </p>
                    </div>

                      <Link to={`/update-product/${product._id}`}>
    <Button color="light" className="w-full">
      {product?.hasVariants ? "Edit Product & Variants" : "Edit Product"}
    </Button>
  </Link>
                  </div>

                  {variantsLoading ? (
                    <div className="mt-3 flex items-center gap-2 text-sm text-gray-500">
                      <Spinner size="sm" /> Loading variants...
                    </div>
                  ) : !variants.length ? (
                    <div className="mt-3 text-sm text-gray-500">No variants found.</div>
                  ) : (
                    <div className="mt-3 overflow-x-auto">
                      <Table hoverable>
                        <Table.Head>
                          <Table.HeadCell>Variant</Table.HeadCell>
                          <Table.HeadCell>Barcode</Table.HeadCell>
                          <Table.HeadCell className="text-right">Size</Table.HeadCell>
                          <Table.HeadCell className="text-right">Price</Table.HeadCell>
                          <Table.HeadCell>Status</Table.HeadCell>
                        </Table.Head>
                        <Table.Body className="divide-y">
                          {variants.map((v) => (
                            <Table.Row key={v._id}>
                              <Table.Cell>
                                <div className="font-semibold">{v.name}</div>
                              </Table.Cell>
                              <Table.Cell className="text-sm">{v.barcode || "—"}</Table.Cell>
                              <Table.Cell className="text-right">
                                {Number(v.unitSizeInBase || 0).toLocaleString()} {product.baseUnit}
                              </Table.Cell>
                              <Table.Cell className="text-right">
                                KES {Number(v.price || 0).toLocaleString()}
                              </Table.Cell>
                              <Table.Cell>
                                <span
                                  className={`text-sm font-semibold ${
                                    v.isActive !== false ? "text-green-600" : "text-red-600"
                                  }`}
                                >
                                  {v.isActive !== false ? "Active" : "Inactive"}
                                </span>
                              </Table.Cell>
                            </Table.Row>
                          ))}
                        </Table.Body>
                      </Table>

                      <div className="mt-2 text-xs text-gray-500">
                        To sell a variant, go to <b>POS</b> and scan/search the variant.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ACTIONS */}
            <div className="w-full md:w-[220px] flex flex-col gap-3">
              <Link to="/dashboard?tab=POS">
                <Button disabled={!sellEnabled} className="w-full">
                  Sell Now
                </Button>
              </Link>

              {/* keep your old modal for normal products only */}
              {/* {!product?.hasVariants && (
                <Button
                  color="light"
                  onClick={() => setOpenModal(true)}
                  disabled={!sellEnabled}
                  className="w-full"
                >
                  Quick Sale (This Page)
                </Button>
              )} */}

              <Button
                color="light"
                onClick={() => navigate("/dashboard?tab=products")}
                className="w-full"
              >
                Back to Products
              </Button>

                <Link to={`/update-product/${product._id}`}>
    <Button color="light" className="w-full">
      {product?.hasVariants ? "Edit Product & Variants" : "Edit Product"}
    </Button>
  </Link>

              <p className="text-xs text-gray-500 text-center">
                {sellEnabled ? "Ready to sell" : "Add stock to enable selling"}
              </p>

              {product?.hasVariants && (
                <p className="text-xs text-gray-500 text-center">
                  Variant product: use POS to select size.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* SALE MODAL (normal products only) */}
        {!product?.hasVariants && (
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
                      KES {(Number(quantity) * Number(product?.price || 0)).toLocaleString()}
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
        )}

        {/* THERMAL RECEIPT MODAL */}
        <ThermalReceiptModal show={openReceiptModal} onClose={onCloseReceipt} receipt={receipt} />

        {/* RECENT PRODUCTS */}
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
                      <p className="font-semibold text-gray-900 dark:text-white">{p.name}</p>
                      <p className="text-sm text-gray-500">
                        {p.category ? p.category : "—"} • {p.type ? p.type : "—"}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold text-gray-900 dark:text-white">
                        KES {Number(p.price || 0).toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500">
                        Stock:{" "}
                        {p.hasVariants
                          ? `${Number(p.stockBaseQty || 0).toLocaleString()} ${p.baseUnit || "ml"}`
                          : `${p.quantity ?? 0}`}
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
