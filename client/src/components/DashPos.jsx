import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Button, Label, TextInput, Spinner, Table, Modal } from "flowbite-react";
import { enqueueSnackbar } from "notistack";
import ThermalReceiptModal from "../components/ThermalReceiptModal.jsx";

export default function POS() {
  const barcodeRef = useRef(null);
  const receiptRef = useRef(null);

  const [barcodeInput, setBarcodeInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [openReceipt, setOpenReceipt] = useState(false);

  // ✅ cart supports both PRODUCT and VARIANT
  // PRODUCT: { kind:"PRODUCT", productId, name, barcode, price, qty }
  // VARIANT: { kind:"VARIANT", variantId, productId(base), name, barcode, price, qty }
  const [cart, setCart] = useState([]);
  const [error, setError] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  // ✅ searchResults supports both products + variants
  const [searchResults, setSearchResults] = useState({ products: [], variants: [] });

  const [discount, setDiscount] = useState(0);

  // ✅ Register session
  const [register, setRegister] = useState(null);
  const [loadingRegister, setLoadingRegister] = useState(true);
  const [openRegisterModal, setOpenRegisterModal] = useState(false);
  const [openingFloat, setOpeningFloat] = useState("");
  const [registerError, setRegisterError] = useState("");

  // Checkout modal
  const [openPay, setOpenPay] = useState(false);
  const [payMethod, setPayMethod] = useState("CASH"); // CASH | MPESA
  const [amountPaid, setAmountPaid] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  const readJsonSafe = async (res) => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    const checkRegister = async () => {
      try {
        setLoadingRegister(true);
        const res = await fetch("/api/register/open");
        const data = await readJsonSafe(res);

        if (!res.ok) throw new Error(data?.message || "Failed to check register");

        setRegister(data); // can be null
        if (!data) setOpenRegisterModal(true);
      } catch (e) {
        setRegisterError(e.message);
        setOpenRegisterModal(true);
      } finally {
        setLoadingRegister(false);
      }
    };

    checkRegister();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const subtotal = useMemo(
    () => cart.reduce((sum, i) => sum + Number(i.price || 0) * Number(i.qty || 0), 0),
    [cart]
  );
  const total = useMemo(() => Math.max(0, subtotal - Number(discount || 0)), [subtotal, discount]);
  const change = useMemo(() => {
    if (payMethod !== "CASH") return 0;
    const paid = Number(amountPaid || 0);
    return Math.max(0, paid - total);
  }, [payMethod, amountPaid, total]);

  // ✅ addToCart merges by variantId (for VARIANT) or productId (for PRODUCT)
  const addToCart = (item, qtyToAdd = 1) => {
    setCart((prev) => {
      const key = item.kind === "VARIANT" ? `v:${item.variantId}` : `p:${item.productId}`;

      const idx = prev.findIndex((x) => {
        const xKey = x.kind === "VARIANT" ? `v:${x.variantId}` : `p:${x.productId}`;
        return xKey === key;
      });

      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: Number(copy[idx].qty || 0) + Number(qtyToAdd || 1) };
        return copy;
      }

      return [
        ...prev,
        {
          ...item,
          qty: Number(qtyToAdd || 1),
        },
      ];
    });
  };

  const handleOpenRegister = async () => {
    try {
      setRegisterError("");
      const res = await fetch("/api/register/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingFloat: Number(openingFloat || 0) }),
      });

      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Failed to open register");

      setRegister(data);
      setOpenRegisterModal(false);
      enqueueSnackbar("Register opened", { variant: "success" });
      barcodeRef.current?.focus();
    } catch (e) {
      setRegisterError(e.message);
    }
  };

  const handleCloseRegister = async () => {
    const closingCash = prompt("Enter closing cash count (KES):", "0");
    if (closingCash === null) return;

    try {
      const res = await fetch("/api/register/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closingCash: Number(closingCash || 0) }),
      });

      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Failed to close register");

      enqueueSnackbar("Register closed", { variant: "success" });
      setRegister(null);
      setOpenRegisterModal(true);
    } catch (e) {
      setError(e.message);
    }
  };

  // ✅ Barcode lookup supports VARIANT + PRODUCT (from API matched.kind)
  const findByBarcodeAndAdd = async (overrideCode) => {
    const code = (overrideCode ?? barcodeInput).trim();
    setError("");
    if (!code) return;

    try {
      setLookupLoading(true);
      const res = await fetch(`/api/product/getproducts?barcode=${encodeURIComponent(code)}&limit=1`);
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Barcode lookup failed");

      if (!data?.matched) {
        enqueueSnackbar("Barcode not found", { variant: "warning" });
        setError("Barcode not found.");
        return;
      }

      if (data.matched.kind === "VARIANT") {
        const v = data.variants?.[0];
        const base = v?.baseProduct || data.products?.[0];

        if (!v || !base) throw new Error("Variant found but missing base product.");

        addToCart(
          {
            kind: "VARIANT",
            variantId: v._id,
            productId: base._id, // base product id
            name: v.name,
            barcode: v.barcode || "",
            price: Number(v.price || 0),
          },
          1
        );

        setBarcodeInput("");
        enqueueSnackbar("Added variant to cart", { variant: "success" });
        barcodeRef.current?.focus();
        return;
      }

      // PRODUCT
      const p = data?.products?.[0];
      if (!p) {
        enqueueSnackbar("Barcode not found", { variant: "warning" });
        setError("Barcode not found.");
        return;
      }

      addToCart(
        {
          kind: "PRODUCT",
          productId: p._id,
          name: p.name,
          barcode: p.barcode || "",
          price: Number(p.price || 0),
        },
        1
      );

      setBarcodeInput("");
      enqueueSnackbar("Added to cart", { variant: "success" });
      barcodeRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setLookupLoading(false);
    }
  };

  // ✅ Search returns both products + variants
  const searchByName = async () => {
    const q = searchTerm.trim();
    setError("");
    setSearchResults({ products: [], variants: [] });
    if (!q) return setError("Type something to search.");

    try {
      setSearchLoading(true);
      const res = await fetch(`/api/product/getproducts?searchTerm=${encodeURIComponent(q)}&limit=20`);
      const data = await readJsonSafe(res);
      if (!res.ok) throw new Error(data?.message || "Search failed");

      setSearchResults({
        products: data?.products || [],
        variants: data?.variants || [],
      });

      if (!data?.products?.length && !data?.variants?.length) {
        enqueueSnackbar("No products found", { variant: "info" });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setSearchLoading(false);
    }
  };

  // ✅ updateQty/removeItem handle both kinds
  const updateQty = (item, qty) => {
    setCart((prev) =>
      prev
        .map((i) => {
          const same =
            i.kind === item.kind &&
            (i.kind === "VARIANT" ? i.variantId === item.variantId : i.productId === item.productId);
          return same ? { ...i, qty: Math.max(1, Number(qty || 1)) } : i;
        })
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (item) => {
    setCart((prev) =>
      prev.filter((i) => {
        const same =
          i.kind === item.kind &&
          (i.kind === "VARIANT" ? i.variantId === item.variantId : i.productId === item.productId);
        return !same;
      })
    );
  };

  const clearSale = () => {
    setCart([]);
    setSearchTerm("");
    setSearchResults({ products: [], variants: [] });
    setDiscount(0);
    setAmountPaid("");
    setPayMethod("CASH");
    setLastSale(null);
    setError("");
    barcodeRef.current?.focus();
  };

  const checkout = async () => {
    setError("");
    if (!cart.length) return setError("Cart is empty.");
    if (!register?._id) return setError("Open register to start selling.");

    const paid = Number(amountPaid || 0);

    if (payMethod === "CASH" && paid < total) return setError("Cash paid is less than total.");
    if (payMethod === "MPESA" && paid < total) return setError("M-Pesa amount is less than total.");

    try {
      setCheckoutLoading(true);

      const payload = {
        registerId: register?._id,
        items: cart.map((i) =>
          i.kind === "VARIANT"
            ? { variantId: i.variantId, qty: i.qty }
            : { productId: i.productId, qty: i.qty }
        ),
        discount: Number(discount || 0),
        payment: {
          method: payMethod,
          amountPaid: paid,
        },
      };

      const res = await fetch("/api/sale/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await readJsonSafe(res);

      if (!res.ok) {
        throw new Error(data?.message || "Checkout failed");
      }

      setLastSale(data?.sale);
      setOpenPay(false);
      setOpenReceipt(true);
      enqueueSnackbar("Sale completed!", { variant: "success" });

      // reset sale state
      setCart([]);
      setSearchTerm("");
      setSearchResults({ products: [], variants: [] });
      setDiscount(0);
      setAmountPaid("");
      setPayMethod("CASH");
      setError("");
      barcodeRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const printReceipt = () => {
    const receiptHtml = receiptRef.current?.innerHTML;
    if (!receiptHtml) return;

    const w = window.open("", "_blank", "width=380,height=700");
    if (!w) return;

    w.document.open();
    w.document.write(`
      <html>
      <head>
        <title>Receipt</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 10px; }
          .center { text-align:center; }
          table { width:100%; border-collapse: collapse; }
          td, th { padding: 6px 0; font-size: 12px; }
          .line { border-top: 1px dashed #000; margin: 8px 0; }
          .right { text-align:right; }
          .bold { font-weight:700; }
        </style>
      </head>
      <body>${receiptHtml}</body>
      </html>
    `);
    w.document.close();
    w.focus();
    w.print();
    w.close();
  };

  if (loadingRegister) {
    return <Alert color="info">Loading POS...</Alert>;
  }

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Button color="light" onClick={clearSale}>
          New Sale
        </Button>

        <Button color="success" onClick={() => setOpenRegisterModal(true)} disabled={!!register}>
          Open Register
        </Button>

        <Button color="failure" onClick={handleCloseRegister} disabled={!register}>
          Close Register
        </Button>

        {register ? (
          <p className="text-xs text-green-600">Register OPEN</p>
        ) : (
          <p className="text-xs text-red-600">Register CLOSED</p>
        )}
      </div>

      {error && <Alert color="failure">{error}</Alert>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT: SCAN + SEARCH */}
        <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-4">
          <div className="space-y-2">
            <h2 className="font-semibold">Scan Barcode</h2>
            <Label value="Barcode" />
            <div className="flex gap-2">
              <TextInput
                ref={barcodeRef}
                value={barcodeInput}
                onChange={(e) => setBarcodeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    findByBarcodeAndAdd();
                  }
                }}
                placeholder="Scan barcode then Enter..."
              />
              <Button onClick={() => findByBarcodeAndAdd()} disabled={lookupLoading}>
                {lookupLoading ? <Spinner size="sm" /> : "Add"}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="font-semibold">Search by Name</h2>
            <Label value="Product name" />
            <div className="flex gap-2">
              <TextInput
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchByName()}
                placeholder="e.g. sugar, milk 30l"
              />
              <Button onClick={searchByName} disabled={searchLoading}>
                {searchLoading ? <Spinner size="sm" /> : "Search"}
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-auto">
              {/* VARIANTS FIRST */}
              {(searchResults.variants || []).map((v) => {
                const base = v.baseProduct;
                const stock = base?.stockBaseQty ?? base?.quantity ?? 0;
                return (
                  <div
                    key={v._id}
                    className="border rounded p-3 bg-gray-50 dark:bg-gray-900 flex justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <div className="font-semibold truncate">
                        {v.name} <span className="text-xs text-blue-600">VARIANT</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        Base: {base?.name || "—"} • Stock: {stock} • KES{" "}
                        {Number(v.price || 0).toLocaleString()}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() =>
                        addToCart(
                          {
                            kind: "VARIANT",
                            variantId: v._id,
                            productId: base?._id,
                            name: v.name,
                            barcode: v.barcode || "",
                            price: Number(v.price || 0),
                          },
                          1
                        )
                      }
                    >
                      Add
                    </Button>
                  </div>
                );
              })}

              {/* PRODUCTS */}
              {(searchResults.products || []).map((p) => (
                <div
                  key={p._id}
                  className="border rounded p-3 bg-gray-50 dark:bg-gray-900 flex justify-between gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.category} • Stock: {(p.stockBaseQty ?? p.quantity ?? 0)} • KES{" "}
                      {Number(p.price || 0).toLocaleString()}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() =>
                      addToCart(
                        {
                          kind: "PRODUCT",
                          productId: p._id,
                          name: p.name,
                          barcode: p.barcode || "",
                          price: Number(p.price || 0),
                        },
                        1
                      )
                    }
                  >
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE: CART */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
          <h2 className="font-semibold">Cart</h2>

          {!cart.length ? (
            <div className="text-sm text-gray-500">Scan or search products to add them.</div>
          ) : (
            <Table hoverable>
              <Table.Head>
                <Table.HeadCell>Item</Table.HeadCell>
                <Table.HeadCell className="text-right">Price</Table.HeadCell>
                <Table.HeadCell className="text-right">Qty</Table.HeadCell>
                <Table.HeadCell className="text-right">Total</Table.HeadCell>
                <Table.HeadCell />
              </Table.Head>

              <Table.Body className="divide-y">
                {cart.map((i) => (
                  <Table.Row key={i.kind === "VARIANT" ? i.variantId : i.productId}>
                    <Table.Cell>
                      <div className="font-semibold">
                        {i.name}{" "}
                        {i.kind === "VARIANT" ? (
                          <span className="text-xs text-blue-600">VARIANT</span>
                        ) : null}
                      </div>
                      <div className="text-xs text-gray-500">Barcode: {i.barcode || "—"}</div>
                    </Table.Cell>

                    <Table.Cell className="text-right">KES {Number(i.price).toLocaleString()}</Table.Cell>

                    <Table.Cell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="xs" color="light" onClick={() => updateQty(i, i.qty - 1)}>
                          -
                        </Button>
                        <input
                          className="w-16 text-right border rounded px-2 py-1 bg-transparent"
                          type="number"
                          min={1}
                          value={i.qty}
                          onChange={(e) => updateQty(i, e.target.value)}
                        />
                        <Button size="xs" color="light" onClick={() => updateQty(i, i.qty + 1)}>
                          +
                        </Button>
                      </div>
                    </Table.Cell>

                    <Table.Cell className="text-right">
                      KES {(Number(i.price) * Number(i.qty)).toLocaleString()}
                    </Table.Cell>

                    <Table.Cell className="text-right">
                      <Button size="xs" color="failure" onClick={() => removeItem(i)}>
                        Remove
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          )}

          {/* TOTALS */}
          <div className="border-t pt-3 flex flex-col md:flex-row md:items-end md:justify-between gap-3">
            <div className="flex items-end gap-3">
              <div>
                <Label value="Discount (KES)" />
                <TextInput
                  type="number"
                  min={0}
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1 text-right">
              <div className="text-sm">
                Subtotal: <b>KES {subtotal.toLocaleString()}</b>
              </div>
              <div className="text-sm">
                Discount: <b>KES {Number(discount || 0).toLocaleString()}</b>
              </div>
              <div className="text-lg font-bold">Total: KES {total.toLocaleString()}</div>
              <Button onClick={() => setOpenPay(true)} disabled={!cart.length || !register}>
                Checkout
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PAY MODAL */}
      <Modal show={openPay} onClose={() => setOpenPay(false)} popup size="md">
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Payment</h3>

            <div className="flex gap-2">
              <Button color={payMethod === "CASH" ? "success" : "light"} onClick={() => setPayMethod("CASH")}>
                Cash
              </Button>
              <Button color={payMethod === "MPESA" ? "success" : "light"} onClick={() => setPayMethod("MPESA")}>
                M-Pesa
              </Button>
            </div>

            <div className="text-sm">
              Total: <b>KES {total.toLocaleString()}</b>
            </div>

            <div>
              <Label value={payMethod === "CASH" ? "Cash Paid (KES)" : "M-Pesa Amount (KES)"} />
              <TextInput type="number" min={0} value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} />
            </div>

            {payMethod === "CASH" && (
              <div className="text-sm">
                Change: <b>KES {change.toLocaleString()}</b>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button color="light" onClick={() => setOpenPay(false)}>
                Cancel
              </Button>
              <Button onClick={checkout} disabled={checkoutLoading}>
                {checkoutLoading ? (
                  <span className="flex items-center gap-2">
                    <Spinner size="sm" /> Processing
                  </span>
                ) : (
                  "Complete Sale & Print"
                )}
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      <ThermalReceiptModal show={openReceipt} onClose={() => setOpenReceipt(false)} receipt={lastSale} />

      {/* OPEN REGISTER MODAL */}
      <Modal show={openRegisterModal} onClose={() => setOpenRegisterModal(false)} popup size="md">
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Open Register</h3>

            <div>
              <Label value="Opening cash float (KES) (optional)" />
              <TextInput
                type="number"
                min={0}
                value={openingFloat}
                onChange={(e) => setOpeningFloat(e.target.value)}
                placeholder="e.g. 1000"
              />
            </div>

            {registerError && <Alert color="failure">{registerError}</Alert>}

            <Button onClick={handleOpenRegister} className="w-full">
              Open Register
            </Button>
          </div>
        </Modal.Body>
      </Modal>
    </div>
  );
}
