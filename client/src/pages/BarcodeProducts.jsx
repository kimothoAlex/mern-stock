// src/pages/BarcodeProducts.jsx
import { useEffect, useRef, useState } from "react";
import { Alert, Button, Label, TextInput, Spinner, Modal } from "flowbite-react";
import { enqueueSnackbar } from "notistack";

const emptyForm = {
  barcode: "",
  name: "",
  type: "",
  category: "",
  price: "",
  quantity: "",
  imageUrl: "",
};

export default function BarcodeProducts() {
  const barcodeRef = useRef(null);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  const [error, setError] = useState("");
  const [lookupProduct, setLookupProduct] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  const [form, setForm] = useState(emptyForm);

  // Phone camera scan state
  const [openCamera, setOpenCamera] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const scannerRef = useRef(null); // holds Html5Qrcode instance

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  // Start/stop camera scanner when modal opens/closes
  // Start/stop camera scanner when modal opens/closes
useEffect(() => {
  let cancelled = false;

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  const waitForElement = async (id, timeoutMs = 4000) => {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      const el = document.getElementById(id);
      if (el) return el;
      await sleep(50);
    }
    throw new Error("Scanner UI not ready. Close the modal and try again.");
  };

  const stopScanner = async () => {
    try {
      const s = scannerRef.current;
      if (s) {
        await s.stop().catch(() => {});
        await s.clear().catch(() => {});
      }
    } finally {
      scannerRef.current = null;
      setCameraReady(false);
    }
  };

  const startScanner = async () => {
    try {
      setError("");
      setCameraReady(false);

      // Flowbite modal mount timing
      await waitForElement("qr-reader");

      const mod = await import("html5-qrcode");
      const Html5Qrcode = mod.Html5Qrcode;
      const Html5QrcodeSupportedFormats = mod.Html5QrcodeSupportedFormats;

      if (cancelled) return;

      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: "environment" },
        {
          fps: 12,

          // Smaller box tends to work better for 1D barcodes
          qrbox: { width: 220, height: 220 },

          // BIG one for Android:
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },

          formatsToSupport: [
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.UPC_A,
            Html5QrcodeSupportedFormats.UPC_E,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.ITF,
          ],
        },
        async (decodedText) => {
          if (!decodedText) return;

          await stopScanner();
          setOpenCamera(false);

          setBarcodeInput(decodedText);
          enqueueSnackbar("Scanned!", { variant: "success" });
          await findByBarcode(decodedText);
        },
        () => {}
      );

      if (!cancelled) setCameraReady(true);
    } catch (e) {
      await stopScanner();
      setError(
        e?.message ||
          "Camera scan failed. Make sure you're on HTTPS and allowed camera permission."
      );
    }
  };

  if (openCamera) startScanner();
  else stopScanner();

  return () => {
    cancelled = true;
    stopScanner();
  };
}, [openCamera]);

  const findByBarcode = async (overrideCode) => {
    const code = (overrideCode ?? barcodeInput).trim();
    setError("");
    setLookupProduct(null);

    if (!code) return setError("Scan/enter a barcode first.");

    try {
      setLookupLoading(true);
      const res = await fetch(
        `/api/product/getproducts?barcode=${encodeURIComponent(code)}&limit=1`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to lookup barcode");

      const product = data?.products?.[0] || null;

      if (product) {
        setLookupProduct(product);
        enqueueSnackbar("Product found!", { variant: "success" });
      } else {
        enqueueSnackbar("Barcode not found. Add the product below.", {
          variant: "warning",
        });
        setForm((prev) => ({ ...prev, barcode: code }));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const onBarcodeKeyDown = (e) => {
    // USB scanners usually press Enter after scan
    if (e.key === "Enter") {
      e.preventDefault();
      findByBarcode();
    }
  };

  const updateForm = (e) => {
    const { id, value } = e.target;
    setForm((prev) => ({ ...prev, [id]: value }));
  };

  const validate = () => {
    if (!form.barcode.trim()) return "Barcode is required";
    if (!form.name.trim()) return "Name is required";
    if (!form.type.trim()) return "Type is required";
    if (!form.category.trim()) return "Category is required";
    if (!form.price || Number(form.price) <= 0)
      return "Price must be greater than 0";
    if (form.quantity === "" || Number(form.quantity) < 0)
      return "Quantity must be 0 or more";
    return null;
  };

  const createProduct = async () => {
    setError("");
    const v = validate();
    if (v) return setError(v);

    try {
      setCreateLoading(true);

      const payload = {
        barcode: form.barcode.trim(),
        name: form.name.trim(),
        type: form.type.trim(),
        category: form.category.trim(),
        price: Number(form.price),
        quantity: Number(form.quantity),
        imageUrl: form.imageUrl?.trim() || "",
      };

      const res = await fetch("/api/product/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to create product");

      enqueueSnackbar("Product created successfully!", { variant: "success" });

      setForm(emptyForm);
      setBarcodeInput("");
      setLookupProduct(null);

      barcodeRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const searchProducts = async () => {
    const q = searchTerm.trim();
    setError("");
    setSearchResults([]);
    if (!q) return setError("Type something to search.");

    try {
      setSearchLoading(true);
      const res = await fetch(
        `/api/product/getproducts?searchTerm=${encodeURIComponent(q)}&limit=20`
      );
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Search failed");

      setSearchResults(data?.products || []);
      if (!data?.products?.length)
        enqueueSnackbar("No products found", { variant: "info" });
    } catch (e) {
      setError(e.message);
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      <h1 className="text-2xl font-bold">Add / Find Products (Barcode)</h1>

      {error && <Alert color="failure">{error}</Alert>}

      {/* SCAN / LOOKUP */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Scan / Lookup Barcode</h2>
          <Button color="light" onClick={() => setOpenCamera(true)}>
            Scan with Phone Camera
          </Button>
        </div>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label value="Barcode (scan, type, or use camera)" />
            <TextInput
              ref={barcodeRef}
              value={barcodeInput}
              onChange={(e) => setBarcodeInput(e.target.value)}
              onKeyDown={onBarcodeKeyDown}
              placeholder="Scan barcode here..."
            />
          </div>

          <Button onClick={() => findByBarcode()} disabled={lookupLoading}>
            {lookupLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Checking
              </span>
            ) : (
              "Find"
            )}
          </Button>
        </div>

        {lookupProduct && (
          <div className="border rounded p-3 bg-gray-50 dark:bg-gray-900">
            <div className="font-semibold">{lookupProduct.name}</div>
            <div className="text-sm text-gray-600">
              Barcode: <b>{lookupProduct.barcode || "—"}</b>
            </div>
            <div className="text-sm text-gray-600">
              Price:{" "}
              <b>KES {Number(lookupProduct.price || 0).toLocaleString()}</b> •
              Stock: <b>{lookupProduct.quantity}</b>
            </div>
          </div>
        )}
      </div>

      {/* ADD PRODUCT */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-4">
        <h2 className="text-lg font-semibold">Add Product</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <Label htmlFor="barcode" value="Barcode" />
            <TextInput id="barcode" value={form.barcode} onChange={updateForm} />
          </div>

          <div>
            <Label htmlFor="name" value="Name" />
            <TextInput id="name" value={form.name} onChange={updateForm} />
          </div>

          <div>
            <Label htmlFor="type" value="Type" />
            <TextInput id="type" value={form.type} onChange={updateForm} />
          </div>

          <div>
            <Label htmlFor="category" value="Category" />
            <TextInput
              id="category"
              value={form.category}
              onChange={updateForm}
            />
          </div>

          <div>
            <Label htmlFor="price" value="Price (KES)" />
            <TextInput
              id="price"
              type="number"
              min={0}
              value={form.price}
              onChange={updateForm}
            />
          </div>

          <div>
            <Label htmlFor="quantity" value="Quantity" />
            <TextInput
              id="quantity"
              type="number"
              min={0}
              value={form.quantity}
              onChange={updateForm}
            />
          </div>

          <div className="md:col-span-2">
            <Label htmlFor="imageUrl" value="Image URL (optional)" />
            <TextInput
              id="imageUrl"
              value={form.imageUrl}
              onChange={updateForm}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            color="light"
            onClick={() => {
              setForm(emptyForm);
              setError("");
            }}
          >
            Clear
          </Button>

          <Button onClick={createProduct} disabled={createLoading}>
            {createLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Saving
              </span>
            ) : (
              "Add Product"
            )}
          </Button>
        </div>
      </div>

      {/* FIND PRODUCTS */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
        <h2 className="text-lg font-semibold">Find Products</h2>

        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <Label value="Search by name" />
            <TextInput
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchProducts()}
              placeholder="e.g. sugar"
            />
          </div>

          <Button onClick={searchProducts} disabled={searchLoading}>
            {searchLoading ? (
              <span className="flex items-center gap-2">
                <Spinner size="sm" /> Searching
              </span>
            ) : (
              "Search"
            )}
          </Button>
        </div>

        <div className="space-y-2">
          {searchResults.map((p) => (
            <div
              key={p._id}
              className="border rounded p-3 flex items-center justify-between bg-gray-50 dark:bg-gray-900"
            >
              <div>
                <div className="font-semibold">{p.name}</div>
                <div className="text-sm text-gray-500">
                  {p.category} • {p.type} • Barcode: {p.barcode || "—"} • Stock:{" "}
                  {p.quantity}
                </div>
              </div>
              <div className="font-bold">
                KES {Number(p.price || 0).toLocaleString()}
              </div>
            </div>
          ))}

          {!searchLoading && searchTerm.trim() && searchResults.length === 0 && (
            <div className="text-sm text-gray-500">No results.</div>
          )}
        </div>
      </div>

      {/* CAMERA MODAL */}
      <Modal
        show={openCamera}
        size="lg"
        popup
        onClose={() => setOpenCamera(false)}
      >
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Scan with Camera</h3>
            <p className="text-sm text-gray-500">
              Allow camera permission. Works on <b>HTTPS</b> or <b>localhost</b>.
              Use the back camera for best results.
            </p>

            <div className="border rounded-lg p-2">
              <div id="qr-reader" style={{ width: "100%" }} />
            </div>

            {openCamera && !cameraReady && !error && (
              <div className="text-sm text-gray-500">Starting camera...</div>
            )}

            <div className="flex justify-end">
              <Button color="light" onClick={() => setOpenCamera(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}