import { useEffect, useMemo, useState } from "react";
import { Button, Select, Label, TextInput, Spinner, Table, Modal, Textarea  } from "flowbite-react";
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

export default function MpesaTransactions() {
  const [items, setItems] = useState([]);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);

  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [session, setSession] = useState(null);
const [showClose, setShowClose] = useState(false);
const [showOpen, setShowOpen] = useState(false);
const [closingCashCounted, setClosingCashCounted] = useState("");
const [closingFloatActual, setClosingFloatActual] = useState("");
const [openingCashInHand, setOpeningCashInHand] = useState("");
const [openingFloat, setOpeningFloat] = useState("");
const [showTxn, setShowTxn] = useState(false);
const [txnType, setTxnType] = useState("AGENT_DEPOSIT");
const [txnAmount, setTxnAmount] = useState("");
const [txnMpesaCode, setTxnMpesaCode] = useState("");
const [txnPhone, setTxnPhone] = useState("");
const [txnNote, setTxnNote] = useState("");
const [lastReconciliation, setLastReconciliation] = useState(null)
const [openingNotes, setOpeningNotes] = useState("");

  const queryString = useMemo(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "25");
    if (type) params.set("type", type);
    if (q) params.set("q", q);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    return params.toString();
  }, [ page, type, q, from, to]);
  const fetchSession = async () => {
  try {
    const res = await fetch("/api/mpesa/session/current");
    const data = await res.json();

    if (!res.ok) throw new Error(data?.message || "Failed to load session");

    setSession(data);

    // ✅ If no open session, prompt user to open one
    if (!data) setShowOpen(true);
  } catch (e) {
    enqueueSnackbar(e.message, { variant: "error" });
  }
};

const createTxn = async () => {
  try {
    if (!session?._id) {
      enqueueSnackbar("Open a session first", { variant: "warning" });
      return;
    }

    const amount = Number(txnAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      enqueueSnackbar("Enter a valid amount", { variant: "warning" });
      return;
    }

    const payload = {
      type: txnType,
      amount,
      mpesaCode: txnMpesaCode || undefined,
      phone: txnPhone || undefined,
      note: txnNote || undefined,
    };

    const res = await fetch("/api/mpesa/txns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to create transaction");

    enqueueSnackbar("Transaction saved", { variant: "success" });

    // reset form
    setTxnAmount("");
    setTxnMpesaCode("");
    setTxnPhone("");
    setTxnNote("");
    setTxnType("AGENT_DEPOSIT");

    setShowTxn(false);

    // refresh list + session banner if you have one
    fetchTxns();
  } catch (e) {
    enqueueSnackbar(e.message, { variant: "error" });
  }
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
        closingCashCounted: Number(closingCashCounted),
        closingFloatActual: Number(closingFloatActual),
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to close session");

    // ✅ Store reconciliation so you can display it
    setLastReconciliation(data.reconciliation);

    setShowClose(false);

    // ✅ This is what makes it "close automatically" on screen:
    // current session should become null after this
    await fetchSession();
    await fetchTxns();

    // ✅ Auto export the just-closed session
    window.location.href = `/api/mpesa/session/${data.session._id}/export.csv`;

    enqueueSnackbar("Session closed and exported", { variant: "success" });
  } catch (e) {
    enqueueSnackbar(e.message, { variant: "error" });
  }
};
const openSession = async () => {
  try {
    const res = await fetch("/api/mpesa/session/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        openingCashInHand: Number(openingCashInHand),
        openingFloat: Number(openingFloat),
        notes: openingNotes,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data?.message || "Failed to open session");

    setSession(data);
    setShowOpen(false);

    enqueueSnackbar("Session opened", { variant: "success" });

    // refresh txns (will be empty initially)
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
            <Button color="success" onClick={() => setShowOpen(true)} disabled={!!session}>
  Open Session
</Button>
<Button onClick={() => setShowTxn(true)} disabled={!session?._id}>
  New Transaction
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
{lastReconciliation && (
  <div className="p-3 border rounded bg-gray-50 text-sm space-y-1">
    <div className="font-semibold">Last Session Reconciliation</div>
    <div>Opening Cash: <b>{lastReconciliation.openingCash}</b> | Opening Float: <b>{lastReconciliation.openingFloat}</b></div>
    <div>Total Cash Δ: <b>{lastReconciliation.totalCashDelta}</b> | Total Float Δ: <b>{lastReconciliation.totalFloatDelta}</b></div>
    <div>Expected Cash: <b>{lastReconciliation.expectedCash}</b> | Expected Float: <b>{lastReconciliation.expectedFloat}</b></div>
    <div>Closing Cash: <b>{lastReconciliation.closingCash}</b> | Closing Float: <b>{lastReconciliation.closingFloat}</b></div>
    <div>Cash Variance: <b>{lastReconciliation.cashVariance}</b> | Float Variance: <b>{lastReconciliation.floatVariance}</b></div>
    <div>Transactions: <b>{lastReconciliation.txCount}</b></div>
  </div>
)}

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
      <Modal show={showOpen} onClose={() => {setShowOpen(false);}}>
  <Modal.Header>Open M-Pesa Session</Modal.Header>

  <Modal.Body>
    <div className="space-y-3">
      <div>
        <Label value="Opening Cash in Hand" />
        <TextInput
          type="number"
          value={openingCashInHand}
          onChange={(e) => setOpeningCashInHand(e.target.value)}
          placeholder="e.g. 5000"
          required
        />
      </div>

      <div>
        <Label value="Opening Float" />
        <TextInput
          type="number"
          value={openingFloat}
          onChange={(e) => setOpeningFloat(e.target.value)}
          placeholder="e.g. 50000"
          required
        />
      </div>

      <div>
        <Label value="Notes (optional)" />
        <Textarea
          rows={2}
          value={openingNotes}
          onChange={(e) => setOpeningNotes(e.target.value)}
          placeholder="Any note about today's opening..."
        />
      </div>

      <div className="text-sm text-gray-600">
        You must open a session to start recording M-Pesa transactions.
      </div>
    </div>
  </Modal.Body>

  <Modal.Footer>
    <Button onClick={openSession}>Open Session</Button>
  </Modal.Footer>
</Modal>

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
<Modal show={showTxn} onClose={() => setShowTxn(false)}>
  <Modal.Header>New M-Pesa Transaction</Modal.Header>

  <Modal.Body>
    <div className="space-y-3">
      <div>
        <Label value="Type" />
        <Select value={txnType} onChange={(e) => setTxnType(e.target.value)}>
          <option value="AGENT_DEPOSIT">Deposit (Customer gives cash, you send M-Pesa)</option>
          <option value="AGENT_WITHDRAWAL">Withdrawal (Customer sends M-Pesa, you give cash)</option>
          <option value="FLOAT_TOPUP_CASH">Float Top-up (Using Cash)</option>
          <option value="FLOAT_TOPUP_EXTERNAL">Float Top-up (External/Bank)</option>
          <option value="FLOAT_CASHOUT">Float Cash-out (Convert Float to Cash)</option>
        </Select>
      </div>

      <div>
        <Label value="Amount" />
        <TextInput
          type="number"
          value={txnAmount}
          onChange={(e) => setTxnAmount(e.target.value)}
          placeholder="e.g. 2000"
          required
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <div>
          <Label value="M-Pesa Code (optional)" />
          <TextInput
            value={txnMpesaCode}
            onChange={(e) => setTxnMpesaCode(e.target.value)}
            placeholder="e.g. QAX123ABC"
          />
        </div>

        <div>
          <Label value="Phone (optional)" />
          <TextInput
            value={txnPhone}
            onChange={(e) => setTxnPhone(e.target.value)}
            placeholder="e.g. 07xxxxxxxx"
          />
        </div>
      </div>

      <div>
        <Label value="Note (optional)" />
        <Textarea
          rows={2}
          value={txnNote}
          onChange={(e) => setTxnNote(e.target.value)}
          placeholder="Any details..."
        />
      </div>

      {/* Helpful reminder of accounting effect */}
      <div className="text-sm text-gray-600">
        {txnType === "AGENT_DEPOSIT" && "Effect: Cash ↑, Float ↓"}
        {txnType === "AGENT_WITHDRAWAL" && "Effect: Cash ↓, Float ↑"}
        {txnType === "FLOAT_TOPUP_CASH" && "Effect: Cash ↓, Float ↑"}
        {txnType === "FLOAT_TOPUP_EXTERNAL" && "Effect: Cash →, Float ↑"}
        {txnType === "FLOAT_CASHOUT" && "Effect: Cash ↑, Float ↓"}
      </div>
    </div>
  </Modal.Body>

  <Modal.Footer>
    <Button onClick={createTxn}>Save</Button>
    <Button color="gray" onClick={() => setShowTxn(false)}>Cancel</Button>
  </Modal.Footer>
</Modal>

    </div>
  );
}
