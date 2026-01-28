import { Modal, Table, Button, Label, TextInput, Spinner, Alert } from "flowbite-react";
import { useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import { Link } from "react-router-dom";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { enqueueSnackbar } from "notistack";

const DashProducts = () => {
  const { currentUser } = useSelector((state) => state.user);

  const [products, setProducts] = useState([]);
  const [showMore, setShowMore] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [productIdToDelete, setProductIdToDelete] = useState("");

  // ✅ Find by BARCODE
  const barcodeRef = useRef(null);
  const [barcodeInput, setBarcodeInput] = useState("");
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeResult, setBarcodeResult] = useState(null);
  const [barcodeError, setBarcodeError] = useState("");

  // ✅ Find by NAME
  const nameRef = useRef(null);
  const [nameInput, setNameInput] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameResults, setNameResults] = useState([]);
  const [nameError, setNameError] = useState("");

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/product/getproducts`);
        const data = await res.json();
        if (res.ok) {
          setProducts(data.products);
          if (data.products.length < 9) setShowMore(false);
        }
      } catch (error) {
        console.log(error.message);
      }
    };
    if (currentUser) fetchProducts();
  }, [currentUser?._id]);

  const handleShowMore = async () => {
    const startIndex = products.length;
    try {
      const res = await fetch(`/api/product/getproducts?startIndex=${startIndex}`);
      const data = await res.json();
      if (res.ok) {
        setProducts((prev) => [...prev, ...data.products]);
        if (data.products.length < 9) setShowMore(false);
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleDeleteProduct = async () => {
    setShowModal(false);
    try {
      const res = await fetch(`/api/product/delete/${productIdToDelete}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        console.log(data.message);
      } else {
        setProducts((prev) => prev.filter((product) => product._id !== productIdToDelete));
        enqueueSnackbar("Product deleted successfully", { variant: "success" });
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  // ✅ Find product by barcode
  const findByBarcode = async () => {
    const code = barcodeInput.trim();
    setBarcodeError("");
    setBarcodeResult(null);

    if (!code) return setBarcodeError("Enter a barcode first.");

    try {
      setBarcodeLoading(true);
      const res = await fetch(
        `/api/product/getproducts?barcode=${encodeURIComponent(code)}&limit=1`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to lookup barcode");

      const product = data?.products?.[0] || null;

      if (!product) {
        enqueueSnackbar("No product found for that barcode", { variant: "info" });
        return setBarcodeError("No product found for that barcode.");
      }

      setBarcodeResult(product);
      enqueueSnackbar("Product found!", { variant: "success" });

      // Optional: move it to top if it already exists in current list
      setProducts((prev) => {
        const exists = prev.find((p) => p._id === product._id);
        if (!exists) return prev;
        const filtered = prev.filter((p) => p._id !== product._id);
        return [product, ...filtered];
      });
    } catch (e) {
      setBarcodeError(e.message);
    } finally {
      setBarcodeLoading(false);
    }
  };

  const onBarcodeKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      findByBarcode();
    }
  };

  // ✅ Find products by name
  const findByName = async () => {
    const q = nameInput.trim();
    setNameError("");
    setNameResults([]);

    if (!q) return setNameError("Type a product name to search.");

    try {
      setNameLoading(true);
      const res = await fetch(
        `/api/product/getproducts?searchTerm=${encodeURIComponent(q)}&limit=20`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Search failed");

      const list = data?.products || [];
      setNameResults(list);

      if (!list.length) {
        enqueueSnackbar("No products found", { variant: "info" });
      } else {
        enqueueSnackbar(`Found ${list.length} product(s)`, { variant: "success" });
      }
    } catch (e) {
      setNameError(e.message);
    } finally {
      setNameLoading(false);
    }
  };

  const onNameKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      findByName();
    }
  };

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  return (
    <div className="table-auto overflow-x-scroll md:mx-auto p-3 scrollbar scrollbar-track-slate-100 scrollbar-thumb-slate-300 dark:scrollbar-track-slate-700 dark:scrollbar-thumb-slate-500 space-y-4">
      {/* ✅ FIND PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FIND BY BARCODE */}
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold">Find by Barcode</h2>

          {barcodeError && <Alert color="failure">{barcodeError}</Alert>}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label value="Barcode" />
              <TextInput
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={onBarcodeKeyDown}
                placeholder="Scan or type barcode..."
              />
            </div>

            <Button onClick={findByBarcode} disabled={barcodeLoading}>
              {barcodeLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> Finding
                </span>
              ) : (
                "Find"
              )}
            </Button>

            <Button
              color="light"
              onClick={() => {
                setBarcodeInput("");
                setBarcodeResult(null);
                setBarcodeError("");
                barcodeRef.current?.focus();
              }}
            >
              Clear
            </Button>
          </div>

          {barcodeResult && (
            <div className="border rounded p-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="font-semibold truncate">{barcodeResult.name}</div>
                <div className="text-sm text-gray-500">
                  Barcode: <b>{barcodeResult.barcode || "—"}</b> • Stock:{" "}
                  <b>{barcodeResult.quantity}</b> • Price:{" "}
                  <b>KES {Number(barcodeResult.price || 0).toLocaleString()}</b>
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Link to={`/product/${barcodeResult.slug}`}>
                  <Button size="sm">Open</Button>
                </Link>
                {currentUser?.isAdmin && (
                  <Link to={`/update-product/${barcodeResult._id}`}>
                    <Button size="sm" color="light">
                      Edit
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>

        {/* FIND BY NAME */}
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
          <h2 className="text-lg font-semibold">Find by Product Name</h2>

          {nameError && <Alert color="failure">{nameError}</Alert>}

          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label value="Product name" />
              <TextInput
                ref={nameRef}
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={onNameKeyDown}
                placeholder="e.g. sugar"
              />
            </div>

            <Button onClick={findByName} disabled={nameLoading}>
              {nameLoading ? (
                <span className="flex items-center gap-2">
                  <Spinner size="sm" /> Searching
                </span>
              ) : (
                "Search"
              )}
            </Button>

            <Button
              color="light"
              onClick={() => {
                setNameInput("");
                setNameResults([]);
                setNameError("");
                nameRef.current?.focus();
              }}
            >
              Clear
            </Button>
          </div>

          <div className="space-y-2">
            {nameResults.map((p) => (
              <div
                key={p._id}
                className="border rounded p-3 bg-gray-50 dark:bg-gray-900 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{p.name}</div>
                  <div className="text-sm text-gray-500">
                    {p.category} • {p.type} • Barcode: {p.barcode || "—"} • Stock:{" "}
                    {p.quantity}
                  </div>
                </div>

                <div className="flex gap-2 shrink-0">
                  <div className="font-bold">
                    KES {Number(p.price || 0).toLocaleString()}
                  </div>
                  <Link to={`/product/${p.slug}`}>
                    <Button size="sm">Open</Button>
                  </Link>
                  {currentUser?.isAdmin && (
                    <Link to={`/update-product/${p._id}`}>
                      <Button size="sm" color="light">
                        Edit
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ))}

            {!nameLoading && nameInput.trim() && nameResults.length === 0 && !nameError && (
              <div className="text-sm text-gray-500">No results.</div>
            )}
          </div>
        </div>
      </div>

      {/* PRODUCTS TABLE */}
      {currentUser && products.length > 0 ? (
        <>
          <Table hoverable className="shadow-md">
            <Table.Head>
              <Table.HeadCell>Date updated</Table.HeadCell>
              {/* <Table.HeadCell>Product image</Table.HeadCell> */}
              <Table.HeadCell>Product name</Table.HeadCell>
              <Table.HeadCell>Category</Table.HeadCell>
              <Table.HeadCell>Type</Table.HeadCell>
              <Table.HeadCell>Quantity</Table.HeadCell>
              <Table.HeadCell>Price</Table.HeadCell>
              {currentUser.isAdmin && (
                <>
                  <Table.HeadCell>Delete</Table.HeadCell>
                  <Table.HeadCell>
                    <span>Edit</span>
                  </Table.HeadCell>
                </>
              )}
            </Table.Head>

            {products.map((product) => (
              <Table.Body key={product._id} className="divide-y">
                <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell>{new Date(product.updatedAt).toLocaleDateString()}</Table.Cell>

                  {/* <Table.Cell>
                    <Link to={`/product/${product.slug}`}>
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-20 h-10 object-cover bg-gray-500"
                      />
                    </Link>
                  </Table.Cell> */}

                  <Table.Cell>
                    <Link
                      className="font-medium text-gray-900 dark:text-white"
                      to={`/product/${product.slug}`}
                    >
                      {product.name}
                    </Link>
                  </Table.Cell>

                  <Table.Cell>{product.category}</Table.Cell>
                  <Table.Cell>{product.type}</Table.Cell>
                  <Table.Cell>{product.quantity}</Table.Cell>
                  <Table.Cell>{product.price.toLocaleString()}</Table.Cell>

                  {currentUser.isAdmin && (
                    <>
                      <Table.Cell>
                        <span
                          onClick={() => {
                            setShowModal(true);
                            setProductIdToDelete(product._id);
                          }}
                          className="font-medium text-red-500 hover:underline cursor-pointer"
                        >
                          Delete
                        </span>
                      </Table.Cell>

                      <Table.Cell>
                        <Link
                          className="text-teal-500 hover:underline"
                          to={`/update-product/${product._id}`}
                        >
                          <span>Edit</span>
                        </Link>
                      </Table.Cell>
                    </>
                  )}
                </Table.Row>
              </Table.Body>
            ))}
          </Table>

          {showMore && (
            <button
              onClick={handleShowMore}
              className="w-full text-teal-500 self-center text-sm py-7"
            >
              Show more
            </button>
          )}
        </>
      ) : (
        <p>You have no products yet!</p>
      )}

      <Modal show={showModal} onClose={() => setShowModal(false)} popup size="md">
        <Modal.Header />
        <Modal.Body>
          <div className="text-center">
            <HiOutlineExclamationCircle className="h-14 w-14 text-gray-400 dark:text-gray-200 mb-4 mx-auto" />
            <h3 className="mb-5 text-lg text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this product?
            </h3>
            <div className="flex justify-center gap-4">
              <Button color="failure" onClick={handleDeleteProduct}>
                Yes, I'm sure
              </Button>
              <Button color="gray" onClick={() => setShowModal(false)}>
                No, cancel
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
};

export default DashProducts;