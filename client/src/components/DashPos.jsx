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

  const [cart, setCart] = useState([]); // {productId, name, barcode, price, qty}
  const [error, setError] = useState("");

  const [lookupLoading, setLookupLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState([]);

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
  // const [mpesaCode, setMpesaCode] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [lastSale, setLastSale] = useState(null);

  useEffect(() => {
    barcodeRef.current?.focus();
  }, []);

  useEffect(() => {
  const checkRegister = async () => {
    try {
      setLoadingRegister(true);
      const res = await fetch("/api/register/open"); // GET open register
      const data = await res.json();

      if (!res.ok) throw new Error(data?.message || "Failed to check register");

      setRegister(data); // can be null
      if (!data) setOpenRegisterModal(true); // force open register first
    } catch (e) {
      setRegisterError(e.message);
      setOpenRegisterModal(true);
    } finally {
      setLoadingRegister(false);
    }
  };

  checkRegister();
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

  const addToCart = (product, qtyToAdd = 1) => {
    setCart((prev) => {
      const idx = prev.findIndex((x) => x.productId === product._id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: copy[idx].qty + qtyToAdd };
        return copy;
      }
      return [
        ...prev,
        {
          productId: product._id,
          name: product.name,
          barcode: product.barcode || "",
          price: Number(product.price || 0),
          qty: qtyToAdd,
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
    setOpenRegisterModal(true); // force open again before selling
  } catch (e) {
    setError(e.message);
  }
};
  const findByBarcodeAndAdd = async (overrideCode) => {
    const code = (overrideCode ?? barcodeInput).trim();
    setError("");
    if (!code) return;

    try {
      setLookupLoading(true);
      const res = await fetch(`/api/product/getproducts?barcode=${encodeURIComponent(code)}&limit=1`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Barcode lookup failed");

      const product = data?.products?.[0];
      if (!product) {
        enqueueSnackbar("Barcode not found", { variant: "warning" });
        setError("Barcode not found.");
        return;
      }

      addToCart(product, 1);
      setBarcodeInput("");
      enqueueSnackbar("Added to cart", { variant: "success" });
      barcodeRef.current?.focus();
    } catch (e) {
      setError(e.message);
    } finally {
      setLookupLoading(false);
    }
  };

  const searchByName = async () => {
    const q = searchTerm.trim();
    setError("");
    setSearchResults([]);
    if (!q) return setError("Type something to search.");

    try {
      setSearchLoading(true);
      const res = await fetch(`/api/product/getproducts?searchTerm=${encodeURIComponent(q)}&limit=20`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Search failed");

      setSearchResults(data?.products || []);
      if (!data?.products?.length) enqueueSnackbar("No products found", { variant: "info" });
    } catch (e) {
      setError(e.message);
    } finally {
      setSearchLoading(false);
    }
  };

  const updateQty = (productId, qty) => {
    setCart((prev) =>
      prev
        .map((i) => (i.productId === productId ? { ...i, qty: Math.max(1, Number(qty || 1)) } : i))
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (productId) => {
    setCart((prev) => prev.filter((i) => i.productId !== productId));
  };

  const clearSale = () => {
    setCart([]);
    setSearchTerm("");
    setSearchResults([]);
    setDiscount(0);
    setAmountPaid("");
    // setMpesaCode("");
    setPayMethod("CASH");
    setLastSale(null);
    setError("");
    barcodeRef.current?.focus();
  };

 const readJsonSafe = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const checkout = async () => {
  setError("");
  if (!cart.length) return setError("Cart is empty.");
  if (!register?._id) return setError("Open register to start selling.");

  const paid = Number(amountPaid || 0);

  if (payMethod === "CASH" && paid < total) return setError("Cash paid is less than total.");
  if (payMethod === "MPESA" && paid < total) return setError("M-Pesa amount is less than total.");
  // if (payMethod === "MPESA" && !mpesaCode.trim()) return setError("Enter M-Pesa code.");

  try {
    setCheckoutLoading(true);

    const payload = {
      registerId: register?._id,
      items: cart.map((i) => ({ productId: i.productId, qty: i.qty })),
      discount: Number(discount || 0),
      payment: {
        method: payMethod,
        amountPaid: paid,
        // mpesaCode: payMethod === "MPESA" ? mpesaCode.trim() : "",
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

    // ✅ store receipt FIRST
    setLastSale(data?.sale);
    setOpenPay(false);
    setOpenReceipt(true);
    enqueueSnackbar("Sale completed!", { variant: "success" });

    // ✅ clear cart AFTER storing lastSale
    setCart([]);
    setSearchTerm("");
    setSearchResults([]);
    setDiscount(0);
    setAmountPaid("");
    // setMpesaCode("");
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
  <Button color="light" onClick={clearSale}>New Sale</Button>

  <Button
    color="success"
    onClick={() => setOpenRegisterModal(true)}
    disabled={register}
  >
    Open Register
  </Button>
  <Button
    color="failure"
    onClick={handleCloseRegister}
    disabled={!register}
  >
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
                placeholder="e.g. sugar"
              />
              <Button onClick={searchByName} disabled={searchLoading}>
                {searchLoading ? <Spinner size="sm" /> : "Search"}
              </Button>
            </div>

            <div className="space-y-2 max-h-72 overflow-auto">
              {searchResults.map((p) => (
                <div key={p._id} className="border rounded p-3 bg-gray-50 dark:bg-gray-900 flex justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.category} • Stock: {p.quantity} • KES {Number(p.price || 0).toLocaleString()}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => addToCart(p, 1)}>Add</Button>
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
                  <Table.Row key={i.productId}>
                    <Table.Cell>
                      <div className="font-semibold">{i.name}</div>
                      <div className="text-xs text-gray-500">Barcode: {i.barcode || "—"}</div>
                    </Table.Cell>
                    <Table.Cell className="text-right">KES {Number(i.price).toLocaleString()}</Table.Cell>
                    <Table.Cell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="xs" color="light" onClick={() => updateQty(i.productId, i.qty - 1)}>-</Button>
                        <input
                          className="w-16 text-right border rounded px-2 py-1 bg-transparent"
                          type="number"
                          min={1}
                          value={i.qty}
                          onChange={(e) => updateQty(i.productId, e.target.value)}
                        />
                        <Button size="xs" color="light" onClick={() => updateQty(i.productId, i.qty + 1)}>+</Button>
                      </div>
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      KES {(Number(i.price) * Number(i.qty)).toLocaleString()}
                    </Table.Cell>
                    <Table.Cell className="text-right">
                      <Button size="xs" color="failure" onClick={() => removeItem(i.productId)}>Remove</Button>
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
                <TextInput type="number" min={0} value={discount} onChange={(e) => setDiscount(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1 text-right">
              <div className="text-sm">Subtotal: <b>KES {subtotal.toLocaleString()}</b></div>
              <div className="text-sm">Discount: <b>KES {Number(discount || 0).toLocaleString()}</b></div>
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

            {/* {payMethod === "MPESA" && (
              <div>
                <Label value="M-Pesa Code" />
                <TextInput value={mpesaCode} onChange={(e) => setMpesaCode(e.target.value)} placeholder="e.g. QWE123ABC" />
              </div>
            )} */}

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
              <Button color="light" onClick={() => setOpenPay(false)}>Cancel</Button>
              <Button onClick={checkout} disabled={checkoutLoading}>
                {checkoutLoading ? (
                  <span className="flex items-center gap-2"><Spinner size="sm" /> Processing</span>
                ) : (
                  "Complete Sale & Print"
                )}
              </Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>
      <ThermalReceiptModal
  show={openReceipt}
  onClose={() => setOpenReceipt(false)}
  receipt={lastSale}
/>
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
      {/* HIDDEN RECEIPT TEMPLATE */}
      {/* <div className="hidden">
        <div ref={receiptRef}>
          <div className="center bold">YOUR MINI MARKET</div>
          <div className="center">Tel: 07xx xxx xxx</div>
          <div className="center">Receipt</div>
          <div className="line"></div>

          <div style={{ fontSize: 12 }}>
            Date: {new Date().toLocaleString()}
          </div>

          <div className="line"></div>
          <table>
            <thead>
              <tr>
                <th style={{ textAlign: "left", fontSize: 12 }}>Item</th>
                <th className="right" style={{ fontSize: 12 }}>Qty</th>
                <th className="right" style={{ fontSize: 12 }}>Amt</th>
              </tr>
            </thead>
            <tbody>
              {cart.map((i) => (
                <tr key={i.productId}>
                  <td style={{ fontSize: 12 }}>{i.name}</td>
                  <td className="right" style={{ fontSize: 12 }}>{i.qty}</td>
                  <td className="right" style={{ fontSize: 12 }}>
                    {(Number(i.price) * Number(i.qty)).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="line"></div>
          <div className="right" style={{ fontSize: 12 }}>Subtotal: {subtotal.toLocaleString()}</div>
          <div className="right" style={{ fontSize: 12 }}>Discount: {Number(discount || 0).toLocaleString()}</div>
          <div className="right bold">TOTAL: {total.toLocaleString()}</div>

          <div className="line"></div>
          <div style={{ fontSize: 12 }}>Payment: {payMethod}</div>
          {payMethod === "MPESA" && <div style={{ fontSize: 12 }}>M-Pesa Code: {mpesaCode}</div>}
          <div style={{ fontSize: 12 }}>Paid: {Number(amountPaid || 0).toLocaleString()}</div>
          {payMethod === "CASH" && <div style={{ fontSize: 12 }}>Change: {change.toLocaleString()}</div>}

          <div className="line"></div>
          <div className="center" style={{ fontSize: 12 }}>THANK YOU!</div>
        </div>
      </div> */}
    </div>
  );
}