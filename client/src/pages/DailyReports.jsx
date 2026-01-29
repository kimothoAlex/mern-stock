// src/pages/DailyRegisterReport.jsx
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Label, Spinner, Table, TextInput, Card, Select } from "flowbite-react";

export default function DailyRegisterReport() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);
  const [cashierId, setCashierId] = useState("");

  const [loadingDaily, setLoadingDaily] = useState(false);
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [error, setError] = useState("");

  const [report, setReport] = useState(null);
  const [selectedRegisterId, setSelectedRegisterId] = useState("");
  const [registerDetails, setRegisterDetails] = useState(null); // { register, totalsFromSales, sales, qtySold }

  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

  const varianceBadge = (v) => {
    const val = Number(v || 0);
    const good = Math.abs(val) < 0.000001;
    const color = good ? "text-green-600" : val > 0 ? "text-amber-600" : "text-red-600";
    const label = good ? "Balanced" : val > 0 ? "Over" : "Short";
    return (
      <span className={`${color} font-semibold`}>
        {label} ({money(Math.abs(val))})
      </span>
    );
  };

  const safeJson = async (res) => {
    const text = await res.text();
    try {
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  };

  const fetchRegisterDetails = async (registerId) => {
    if (!registerId) {
      setRegisterDetails(null);
      return;
    }

    setError("");
    try {
      setLoadingRegister(true);

      const params = new URLSearchParams();
      params.set("registerId", registerId);

      const res = await fetch(`/api/register/report/register?${params.toString()}`);
      const data = await safeJson(res);

      if (!res.ok) throw new Error(data?.message || "Failed to load register details");

      setRegisterDetails(data);
    } catch (e) {
      setRegisterDetails(null);
      setError(e.message || "Failed to load register details");
    } finally {
      setLoadingRegister(false);
    }
  };

  const fetchDaily = async (selectedDate = date, selectedCashierId = cashierId) => {
    setError("");
    try {
      setLoadingDaily(true);

      const params = new URLSearchParams();
      if (selectedDate) params.set("date", selectedDate);
      if (selectedCashierId.trim()) params.set("cashierId", selectedCashierId.trim());

      const res = await fetch(`/api/register/report/daily?${params.toString()}`);
      const data = await safeJson(res);

      if (!res.ok) throw new Error(data?.message || "Failed to load daily report");

      setReport(data);

      // pick a default from daily (OPEN if in list, else latest)
      const dailyDefault = data?.defaultRegisterId || data?.registers?.[data?.registers?.length - 1]?._id || "";

      // Try to prefer the currently open register (even if opened earlier than this date)
      const openRes = await fetch(`/api/register/open`);
      const openReg = await safeJson(openRes);
      const openId = openRes.ok && openReg?._id ? openReg._id : "";

      const pickId = openId || dailyDefault || "";
      setSelectedRegisterId(pickId);

      if (pickId) await fetchRegisterDetails(pickId);
      else setRegisterDetails(null);
    } catch (e) {
      setError(e.message || "Failed to load daily report");
      setReport(null);
      setSelectedRegisterId("");
      setRegisterDetails(null);
    } finally {
      setLoadingDaily(false);
    }
  };

  useEffect(() => {
    fetchDaily(today, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const onPickRegister = async (id) => {
    setSelectedRegisterId(id);
    await fetchRegisterDetails(id);
  };

  // CSV 1: sales per row
  const downloadSalesCSV = () => {
    const reg = registerDetails?.register;
    if (!reg) return;

    const sales = registerDetails?.sales || [];
    const totals = registerDetails?.totalsFromSales || {};

    const rows = [];
    rows.push(["Register Sales Report"]);
    rows.push(["Register ID", reg._id]);
    rows.push(["Status", reg.status]);
    rows.push(["Opened At", reg.openedAt ? new Date(reg.openedAt).toLocaleString() : ""]);
    rows.push(["Closed At", reg.closedAt ? new Date(reg.closedAt).toLocaleString() : ""]);
    rows.push(["Opening Float", reg.openingFloat ?? 0]);
    rows.push(["Closing Cash", reg.closingCash ?? 0]);
    rows.push([]);
    rows.push(["Totals From Sales"]);
    rows.push(["Sales Count", totals.salesCount ?? sales.length]);
    rows.push(["Gross Sales", totals.grossSales ?? 0]);
    rows.push(["Cash Sales", totals.cashSales ?? 0]);
    rows.push(["Mpesa Sales", totals.mpesaSales ?? 0]);
    rows.push(["Discount Total", totals.discountTotal ?? 0]);
    rows.push([]);
    rows.push(["Sales"]);
    rows.push([
      "Date/Time",
      "Receipt No",
      "Payment Method",
      "Subtotal",
      "Discount",
      "Total",
      "Amount Paid",
      "Change",
      "Items Count",
      "Sale ID",
    ]);

    sales.forEach((s) => {
      rows.push([
        s.dateSold ? new Date(s.dateSold).toLocaleString() : "",
        s.receiptNo || "",
        s.payment?.method || "",
        s.subtotal ?? 0,
        s.discount ?? 0,
        s.total ?? 0,
        s.payment?.amountPaid ?? 0,
        s.payment?.change ?? 0,
        (s.items || []).length,
        s._id || "",
      ]);
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `register-sales-${reg._id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // CSV 2: items per row (Excel-friendly)
  const downloadItemsCSV = () => {
    const reg = registerDetails?.register;
    if (!reg) return;

    const sales = registerDetails?.sales || [];

    const rows = [];
    rows.push(["Register Items Report"]);
    rows.push(["Register ID", reg._id]);
    rows.push([]);
    rows.push([
      "Date/Time",
      "Receipt No",
      "Payment Method",
      "Sale Total",
      "Product Name",
      "Barcode",
      "Qty",
      "Price/Unit",
      "Item Total",
      "Sale ID",
    ]);

    sales.forEach((s) => {
      const when = s.dateSold ? new Date(s.dateSold).toLocaleString() : "";
      const receipt = s.receiptNo || "";
      const method = s.payment?.method || "";
      const saleTotal = s.total ?? 0;
      const saleId = s._id || "";

      (s.items || []).forEach((it) => {
        rows.push([
          when,
          receipt,
          method,
          saleTotal,
          it.productName || "",
          it.barcode || "",
          it.quantity ?? 0,
          it.pricePerUnit ?? 0,
          it.totalPrice ?? 0,
          saleId,
        ]);
      });
    });

    const csvContent = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `register-items-${reg._id}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const selectedRegisterRow =
    report?.registers?.find((r) => r._id === selectedRegisterId) || null;

  const canDownload = !!registerDetails?.register && !loadingRegister;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Daily Register Report</h1>

        <div className="flex gap-2 flex-wrap">
          <Button
            color="light"
            onClick={() => fetchDaily()}
            disabled={loadingDaily || loadingRegister}
          >
            {(loadingDaily || loadingRegister) ? <Spinner size="sm" /> : "Refresh"}
          </Button>

          <Button color="success" onClick={downloadSalesCSV} disabled={!canDownload}>
            Download Sales CSV
          </Button>

          <Button color="success" onClick={downloadItemsCSV} disabled={!canDownload}>
            Download Items CSV
          </Button>
        </div>
      </div>

      {error && <Alert color="failure">{error}</Alert>}

      {/* FILTERS */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label value="Date (YYYY-MM-DD)" />
            <TextInput type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div>
            <Label value="Cashier ID (optional)" />
            <TextInput
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              placeholder="Leave blank to use current user"
            />
          </div>

          <Button onClick={() => fetchDaily(date, cashierId)} disabled={loadingDaily}>
            {loadingDaily ? <Spinner size="sm" /> : "Run Report"}
          </Button>
        </div>
      </div>

      {!report && !loadingDaily ? (
        <div className="text-sm text-gray-500">Run report to view results.</div>
      ) : null}

      {report && (
        <>
          {/* DAILY SUMMARY */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <div className="text-sm text-gray-500">Date</div>
              <div className="text-xl font-bold">{report.date}</div>
              <div className="text-xs text-gray-500">Cashier: {report.cashierId}</div>
            </Card>

            <Card>
              <div className="text-sm text-gray-500">Sales (from Sales)</div>
              <div className="text-xl font-bold">{report.totalsFromSales?.salesCount || 0} sales</div>
              <div className="text-sm">Gross: <b>{money(report.totalsFromSales?.grossSales)}</b></div>
              <div className="text-sm">Cash: <b>{money(report.totalsFromSales?.cashSales)}</b></div>
              <div className="text-sm">M-Pesa: <b>{money(report.totalsFromSales?.mpesaSales)}</b></div>
              <div className="text-sm">Discounts: <b>{money(report.totalsFromSales?.discountTotal)}</b></div>
            </Card>

            <Card>
              <div className="text-sm text-gray-500">Cash Reconciliation</div>
              <div className="text-sm">Expected: <b>{money(report.cashReconciliation?.expectedCash)}</b></div>
              <div className="text-sm">Counted: <b>{money(report.cashReconciliation?.countedCash)}</b></div>
              <div className="text-sm">Variance: {varianceBadge(report.cashReconciliation?.variance)}</div>
            </Card>
          </div>

          {/* REGISTERS LIST + PICKER */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="font-semibold">Registers</h2>

              <div className="flex items-center gap-2 flex-wrap">
                <Label value="Select register" />
                <Select
                  value={selectedRegisterId}
                  onChange={(e) => onPickRegister(e.target.value)}
                  disabled={!report.registers?.length || loadingRegister}
                >
                  {(report.registers || []).map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.status === "OPEN" ? "🟢 " : ""}{r._id.slice(-6)} — {r.status}
                    </option>
                  ))}
                </Select>

                <Button
                  color="light"
                  onClick={() => fetchRegisterDetails(selectedRegisterId)}
                  disabled={!selectedRegisterId || loadingRegister}
                >
                  {loadingRegister ? <Spinner size="sm" /> : "Load"}
                </Button>
              </div>
            </div>

            {!report.registers?.length ? (
              <div className="text-sm text-gray-500">No registers found for this day.</div>
            ) : (
              <Table hoverable>
                <Table.Head>
                  <Table.HeadCell>Opened</Table.HeadCell>
                  <Table.HeadCell>Closed</Table.HeadCell>
                  <Table.HeadCell>Status</Table.HeadCell>
                  <Table.HeadCell className="text-right">Opening Float</Table.HeadCell>
                  <Table.HeadCell className="text-right">Closing Cash</Table.HeadCell>
                  <Table.HeadCell className="text-right">Sales</Table.HeadCell>
                  <Table.HeadCell className="text-right">Gross</Table.HeadCell>
                  <Table.HeadCell className="text-right">Cash</Table.HeadCell>
                  <Table.HeadCell className="text-right">M-Pesa</Table.HeadCell>
                </Table.Head>

                <Table.Body className="divide-y">
                  {report.registers.map((r) => (
                    <Table.Row
                      key={r._id}
                      className={r._id === selectedRegisterId ? "bg-gray-50 dark:bg-gray-700" : ""}
                      onClick={() => onPickRegister(r._id)}
                    >
                      <Table.Cell>{r.openedAt ? new Date(r.openedAt).toLocaleString() : "—"}</Table.Cell>
                      <Table.Cell>{r.closedAt ? new Date(r.closedAt).toLocaleString() : "—"}</Table.Cell>
                      <Table.Cell>
                        <span className={`font-semibold ${r.status === "OPEN" ? "text-green-600" : "text-gray-600"}`}>
                          {r.status}
                        </span>
                      </Table.Cell>
                      <Table.Cell className="text-right">{money(r.openingFloat)}</Table.Cell>
                      <Table.Cell className="text-right">{money(r.closingCash)}</Table.Cell>
                      <Table.Cell className="text-right">{Number(r.salesCount || 0)}</Table.Cell>
                      <Table.Cell className="text-right">{money(r.grossSales)}</Table.Cell>
                      <Table.Cell className="text-right">{money(r.cashSales)}</Table.Cell>
                      <Table.Cell className="text-right">{money(r.mpesaSales)}</Table.Cell>
                    </Table.Row>
                  ))}
                </Table.Body>
              </Table>
            )}
          </div>

          {/* SELECTED REGISTER DETAILS + SALES */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Selected Register</h2>
              <div className="text-sm text-gray-500">
                {selectedRegisterRow ? `Status: ${selectedRegisterRow.status}` : ""}
              </div>
            </div>

            {!selectedRegisterId ? (
              <div className="text-sm text-gray-500">Select a register to view details.</div>
            ) : loadingRegister ? (
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <Spinner size="sm" /> Loading register...
              </div>
            ) : !registerDetails?.register ? (
              <div className="text-sm text-gray-500">No details found for selected register.</div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <div className="text-sm text-gray-500">Register</div>
                    <div className="text-lg font-bold">{registerDetails.register._id}</div>
                    <div className="text-sm">
                      Opened: <b>{registerDetails.register.openedAt ? new Date(registerDetails.register.openedAt).toLocaleString() : "—"}</b>
                    </div>
                    <div className="text-sm">
                      Closed: <b>{registerDetails.register.closedAt ? new Date(registerDetails.register.closedAt).toLocaleString() : "—"}</b>
                    </div>
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-500">Totals (from Sales)</div>
                    <div className="text-sm">Sales: <b>{registerDetails.totalsFromSales?.salesCount || 0}</b></div>
                    <div className="text-sm">Gross: <b>{money(registerDetails.totalsFromSales?.grossSales)}</b></div>
                    <div className="text-sm">Cash: <b>{money(registerDetails.totalsFromSales?.cashSales)}</b></div>
                    <div className="text-sm">M-Pesa: <b>{money(registerDetails.totalsFromSales?.mpesaSales)}</b></div>
                    <div className="text-sm">Discount: <b>{money(registerDetails.totalsFromSales?.discountTotal)}</b></div>
                  </Card>

                  <Card>
                    <div className="text-sm text-gray-500">Cash & Items</div>
                    <div className="text-sm">Opening Float: <b>{money(registerDetails.register.openingFloat)}</b></div>
                    <div className="text-sm">Closing Cash: <b>{money(registerDetails.register.closingCash)}</b></div>
                    <div className="text-sm">Qty Sold: <b>{Number(registerDetails.qtySold || 0).toLocaleString()}</b></div>
                  </Card>
                </div>

                <div className="border rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-semibold">Sales in this register</div>
                    <div className="text-sm text-gray-500">{registerDetails.sales?.length || 0} sale(s)</div>
                  </div>

                  {!registerDetails.sales?.length ? (
                    <div className="text-sm text-gray-500">No sales found for this register.</div>
                  ) : (
                    <Table hoverable>
                      <Table.Head>
                        <Table.HeadCell>Time</Table.HeadCell>
                        <Table.HeadCell>Receipt</Table.HeadCell>
                        <Table.HeadCell>Payment</Table.HeadCell>
                        <Table.HeadCell className="text-right">Subtotal</Table.HeadCell>
                        <Table.HeadCell className="text-right">Discount</Table.HeadCell>
                        <Table.HeadCell className="text-right">Total</Table.HeadCell>
                        <Table.HeadCell className="text-right">Items</Table.HeadCell>
                      </Table.Head>
                      <Table.Body className="divide-y">
                        {registerDetails.sales.map((s) => (
                          <Table.Row key={s._id}>
                            <Table.Cell>{s.dateSold ? new Date(s.dateSold).toLocaleString() : "—"}</Table.Cell>
                            <Table.Cell>{s.receiptNo || "—"}</Table.Cell>
                            <Table.Cell>{s.payment?.method || "—"}</Table.Cell>
                            <Table.Cell className="text-right">{money(s.subtotal)}</Table.Cell>
                            <Table.Cell className="text-right">{money(s.discount)}</Table.Cell>
                            <Table.Cell className="text-right">{money(s.total)}</Table.Cell>
                            <Table.Cell className="text-right">{(s.items || []).length}</Table.Cell>
                          </Table.Row>
                        ))}
                      </Table.Body>
                    </Table>
                  )}
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}