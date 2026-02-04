import { useEffect, useMemo, useState } from "react";
import { Button, Select, TextInput } from "flowbite-react";
import { enqueueSnackbar } from "notistack";

const TYPES = [
  "",
  "AGENT_DEPOSIT",
  "AGENT_WITHDRAWAL",
  "FLOAT_TOPUP_CASH",
  "FLOAT_TOPUP_EXTERNAL",
  "FLOAT_CASHOUT",
  "REVERSAL",
];

export default function MpesaTransactions({ shopId }) {
  const [items, setItems] = useState([]);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);

  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [session, setSession] = useState(null);
const [showClose, setShowClose] = useState(false);
const [closingCashCounted, setClosingCashCounted] = useState("");
const [closingFloatActual, setClosingFloatActual] = useState("");


  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("shopId", shopId);
    params.set("page", String(page));
    params.set("limit", "25");
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [shopId, page, type, q, from, to]);
  const fetchSession = async () => {
  const res = await fetch(`/api/mpesa/session/current?shopId=${shopId}`);
  const data = await res.json();
  setSession(data);
};

useEffect(() => {
  fetchSession();
}, []);


  const fetchTxns = async () => {
    try {
      const res = await fetch(`/api/mpesa/txns?${queryString}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load transactions");
      setItems(data.items || []);
      setPages(data.pages || 1);
    } catch (e) {
      enqueueSnackbar(e.message, { variant: "error" });
    }
  };

  useEffect(() => {
    fetchTxns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryString]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    params.set("shopId", shopId);
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);

    // This triggers download because backend sets Content-Disposition: attachment
    window.location.href = `/api/mpesa/txns/export.csv?${params.toString()}`;
  };
const exportSession = () => {
  if (!session?._id) {
    enqueueSnackbar("No open session", { variant: "warning" });
    return;
  }

  window.location.href = `/api/mpesa/session/${session._id}/export.csv`;
};
const closeSession = async () => {
  try {
    const res = await fetch("/api/mpesa/session/close", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        shopId,
        closingCashCounted: Number(closingCashCounted),
        closingFloatActual: Number(closingFloatActual),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    setShowClose(false);

    // auto download report
    window.location.href = `/api/mpesa/session/${data.session._id}/export.csv`;

    fetchSession();
    fetchTxns();
  } catch (e) {
    enqueueSnackbar(e.message, { variant: "error" });
  }
};


  return (
    <div className="p-4 space-y-3">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2 w-full md:w-auto">
          <Select value={type} onChange={(e) => { setPage(1); setType(e.target.value); }}>
            {TYPES.map((t) => (
              <option key={t} value={t}>{t || "All types"}</option>
            ))}
          </Select>

          <TextInput
            placeholder="Search mpesa code / phone / note"
            value={q}
            onChange={(e) => { setPage(1); setQ(e.target.value); }}
          />

          <TextInput
            type="date"
            value={from}
            onChange={(e) => { setPage(1); setFrom(e.target.value); }}
          />

          <TextInput
            type="date"
            value={to}
            onChange={(e) => { setPage(1); setTo(e.target.value); }}
          />
        </div>

        <div className="flex gap-2">
          <Button color="gray" onClick={fetchTxns}>Refresh</Button>
          <Button onClick={exportCsv}>Export Filtered</Button>

            <Button color="success" onClick={exportSession}>
            Export This Session
            </Button>
            <Button
    color="failure"
    onClick={() => setShowClose(true)}
    disabled={!session?._id}
  >
    Close Session
  </Button>
        </div>

      </div>

      <div className="overflow-x-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-left">Time</th>
              <th className="p-2 text-left">Type</th>
              <th className="p-2 text-right">Amount</th>
              <th className="p-2 text-right">Cash Δ</th>
              <th className="p-2 text-right">Float Δ</th>
              <th className="p-2 text-left">M-Pesa Code</th>
              <th className="p-2 text-left">Phone</th>
              <th className="p-2 text-left">Note</th>
            </tr>
          </thead>
          <tbody>
            {items.map((t) => (
              <tr key={t._id} className="border-t">
                <td className="p-2">{new Date(t.createdAt).toLocaleString()}</td>
                <td className="p-2">{t.type}</td>
                <td className="p-2 text-right">{t.amount?.toLocaleString?.() ?? t.amount}</td>
                <td className="p-2 text-right">{t.cashDelta}</td>
                <td className="p-2 text-right">{t.floatDelta}</td>
                <td className="p-2">{t.mpesaCode || "-"}</td>
                <td className="p-2">{t.phone || "-"}</td>
                <td className="p-2">{t.note || "-"}</td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr><td className="p-3 text-center text-gray-500" colSpan={8}>No transactions found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <Button color="gray" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Prev</Button>
        <div className="text-sm text-gray-600">Page {page} of {pages}</div>
        <Button color="gray" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</Button>
      </div>
      <Modal show={showClose} onClose={() => setShowClose(false)}>
  <Modal.Header>Close M-Pesa Session</Modal.Header>

  <Modal.Body>
    <div className="space-y-3">
      <div>
        <Label value="Closing Cash Counted" />
        <TextInput
          type="number"
          value={closingCashCounted}
          onChange={(e) => setClosingCashCounted(e.target.value)}
        />
      </div>

      <div>
        <Label value="Closing Float Actual" />
        <TextInput
          type="number"
          value={closingFloatActual}
          onChange={(e) => setClosingFloatActual(e.target.value)}
        />
      </div>
    </div>
  </Modal.Body>

  <Modal.Footer>
    <Button color="failure" onClick={closeSession}>
      Close & Export
    </Button>

    <Button color="gray" onClick={() => setShowClose(false)}>
      Cancel
    </Button>
  </Modal.Footer>
</Modal>

    </div>
  );
}
