import { Modal, Button } from "flowbite-react";
import { useMemo } from "react";
import { QRCodeCanvas } from "qrcode.react";
import RECEIPT_CONFIG from "../config/shop.js";
import { formatMoney } from "../utils/money.js";

function buildQrValue(sale, formattedDate) {
  const cfg = RECEIPT_CONFIG;

  const receiptNo = sale?.receiptNo ?? "";
  const total = Number(sale?.total ?? 0);
  const itemCount = Array.isArray(sale?.items) ? sale.items.length : 0;

  if (cfg.qrMode === "url") {
    const r = encodeURIComponent(receiptNo);
    return `${cfg.verifyBaseUrl}?receipt=${r}`;
  }

  if (cfg.qrMode === "text") {
    return `${cfg.shopName} | R#${receiptNo} | Items:${itemCount} | Total:${total} | ${formattedDate}`;
  }

  // default: "json"
  return JSON.stringify({
    shop: cfg.shopName,
    receiptNo,
    items: sale?.items?.map((i) => ({
      name: i.productName,
      qty: Number(i.quantity || 0),
      unit: Number(i.pricePerUnit || 0),
      total: Number(i.totalPrice || 0),
    })) || [],
    subtotal: Number(sale?.subtotal || 0),
    discount: Number(sale?.discount || 0),
    total,
    payment: sale?.payment || {},
    date: formattedDate,
  });
}

export default function ThermalReceiptModal({ show, onClose, receipt }) {
  const cfg = RECEIPT_CONFIG;

  const data = useMemo(() => {
    if (!receipt) return null;

    const d = receipt.dateSold || receipt.createdAt;
    const date = d ? new Date(d).toLocaleString(cfg.locale) : "";

    const items = (receipt.items || []).map((i) => {
      const qty = Number(i.quantity ?? 0);
      const unit = Number(i.pricePerUnit ?? 0);
      const total = Number(i.totalPrice ?? qty * unit);

      return {
        productName: i.productName ?? "",
        qty,
        unit,
        total,
      };
    });

    const subtotal = Number(receipt.subtotal ?? 0);
    const discount = Number(receipt.discount ?? 0);
    const total = Number(receipt.total ?? Math.max(0, subtotal - discount));

    const payMethod = receipt?.payment?.method || "CASH";
    const amountPaid = Number(receipt?.payment?.amountPaid ?? 0);
    const change = Number(receipt?.payment?.change ?? 0);
    const mpesaCode = receipt?.payment?.mpesaCode ?? "";

    const qrValue = buildQrValue(receipt, date);

    return {
      receiptNo: receipt.receiptNo ?? "",
      date,
      items,
      subtotal,
      discount,
      total,
      payMethod,
      amountPaid,
      change,
      mpesaCode,
      qrValue,
    };
  }, [receipt, cfg.locale]);

  const handlePrint = () => {
    // prints the page; make sure you have print CSS to only print #print-area
    window.print();
  };

  return (
    <Modal show={show} size="md" onClose={onClose} popup>
      <Modal.Header />
      <Modal.Body>
        <div className="space-y-3">
          {/* PRINT AREA */}
          <div
            id="print-area"
            className="thermal"
            style={{ width: `${cfg.paperWidthMm}mm`, maxWidth: `${cfg.paperWidthMm}mm` }}
          >
            {/* Header */}
            <div className="thermal__center">
              <div className="thermal__shop">{cfg.shopName}</div>
              <div className="thermal__sub">M Minimart</div>
            </div>

            <div className="thermal__hr" />

            {/* Meta */}
            <div className="thermal__row">
              <span>Receipt No</span>
              <span className="thermal__bold">{data?.receiptNo}</span>
            </div>
            <div className="thermal__row">
              <span>Date</span>
              <span className="thermal__right">{data?.date}</span>
            </div>

            <div className="thermal__hr" />

            {/* Items header */}
            <div className="thermal__row thermal__bold">
              <span>ITEM</span>
              <span className="thermal__right">AMOUNT</span>
            </div>

            {/* Items list */}
            <div className="space-y-2">
              {data?.items?.map((i, idx) => (
                <div key={idx}>
                  <div className="thermal__itemName">{i.productName}</div>

                  <div className="thermal__row">
                    <span>
                      {i.qty} x{" "}
                      {formatMoney(i.unit, { currency: cfg.currency, locale: cfg.locale })}
                    </span>
                    <span className="thermal__right">
                      {formatMoney(i.total, { currency: cfg.currency, locale: cfg.locale })}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="thermal__hr" />

            {/* Totals */}
            <div className="thermal__row">
              <span>Subtotal</span>
              <span className="thermal__right">
                {formatMoney(data?.subtotal, { currency: cfg.currency, locale: cfg.locale })}
              </span>
            </div>

            <div className="thermal__row">
              <span>Discount</span>
              <span className="thermal__right">
                {formatMoney(data?.discount, { currency: cfg.currency, locale: cfg.locale })}
              </span>
            </div>

            <div className="thermal__row thermal__total">
              <span>TOTAL</span>
              <span className="thermal__right">
                {formatMoney(data?.total, { currency: cfg.currency, locale: cfg.locale })}
              </span>
            </div>

            <div className="thermal__hr" />

            {/* Payment */}
            <div className="thermal__row">
              <span>Payment</span>
              <span className="thermal__right thermal__bold">{data?.payMethod}</span>
            </div>

            {/* {data?.payMethod === "MPESA" && (
              <div className="thermal__row">
                <span>M-Pesa Code</span>
                <span className="thermal__right">{data?.mpesaCode || "-"}</span>
              </div>
            )} */}

            <div className="thermal__row">
              <span>Paid</span>
              <span className="thermal__right">
                {formatMoney(data?.amountPaid, { currency: cfg.currency, locale: cfg.locale })}
              </span>
            </div>

            {data?.payMethod === "CASH" && (
              <div className="thermal__row">
                <span>Change</span>
                <span className="thermal__right">
                  {formatMoney(data?.change, { currency: cfg.currency, locale: cfg.locale })}
                </span>
              </div>
            )}

            <div className="thermal__hr" />

            {/* QR */}
            <div className="thermal__center thermal__qrWrap">
              <QRCodeCanvas value={data?.qrValue || ""} size={cfg.qrSizePx} includeMargin={false} />
              <div className="thermal__tiny">Scan to verify receipt</div>
            </div>

            {/* Footer */}
            <div className="thermal__center thermal__tiny" style={{ marginTop: 8 }}>
              {cfg.footerText}
            </div>
          </div>

          {/* ACTIONS (won't print) */}
          <div className="flex gap-2 justify-end no-print">
            <Button color="light" onClick={onClose}>
              Close
            </Button>
            <Button onClick={handlePrint}>Print (80mm) / Save PDF</Button>
          </div>
        </div>
      </Modal.Body>
    </Modal>
  );
}