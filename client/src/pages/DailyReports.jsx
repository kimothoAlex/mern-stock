import { useEffect, useMemo, useState } from "react";
import { Alert, Button, Label, Spinner, Table, TextInput, Card } from "flowbite-react";

export default function DailyRegisterReport() {
  // default to today (YYYY-MM-DD)
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [date, setDate] = useState(today);

  const [cashierId, setCashierId] = useState(""); // optional (admin use)
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [report, setReport] = useState(null);

  const fetchReport = async (selectedDate = date, selectedCashierId = cashierId) => {
    setError("");
    setReport(null);

    try {
      setLoading(true);

      const params = new URLSearchParams();
      if (selectedDate) params.set("date", selectedDate);
      if (selectedCashierId.trim()) params.set("cashierId", selectedCashierId.trim());

      const res = await fetch(`/api/register/report/daily?${params.toString()}`);
      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }

      if (!res.ok) throw new Error(data?.message || "Failed to load report");

      setReport(data);
      
    } catch (e) {
      setError(e.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport(today, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today]);

  const money = (n) => `KES ${Number(n || 0).toLocaleString()}`;

  const varianceBadge = (v) => {
    const val = Number(v || 0);
    const good = Math.abs(val) < 0.000001;
    const color = good ? "text-green-600" : val > 0 ? "text-amber-600" : "text-red-600";
    const label = good ? "Balanced" : val > 0 ? "Over" : "Short";
    return <span className={`${color} font-semibold`}>{label} ({money(Math.abs(val))})</span>;
  };
const downloadCSV = () => {
  if (!report) return;

  const rows = [];

  // --- Summary section ---
  rows.push(["Daily Register Report"]);
  rows.push(["Date", report.date]);
  rows.push(["Cashier ID", report.cashierId]);
  rows.push([]);

  rows.push(["Sales Summary"]);
  rows.push(["Sales Count", report.totalsFromSales.salesCount]);
  rows.push(["Gross Sales", report.totalsFromSales.grossSales]);
  rows.push(["Cash Sales", report.totalsFromSales.cashSales]);
  rows.push(["Mpesa Sales", report.totalsFromSales.mpesaSales]);
  rows.push(["Discount Total", report.totalsFromSales.discountTotal]);
  rows.push([]);

  rows.push(["Cash Reconciliation"]);
  rows.push(["Expected Cash", report.cashReconciliation.expectedCash]);
  rows.push(["Counted Cash", report.cashReconciliation.countedCash]);
  rows.push(["Variance", report.cashReconciliation.variance]);
  rows.push([]);

  // --- Register table header ---
  rows.push([
    "Opened At",
    "Closed At",
    "Status",
    "Opening Float",
    "Closing Cash",
    "Sales Count",
    "Gross Sales",
    "Cash Sales",
    "Mpesa Sales",
  ]);

  // --- Register rows ---
  report.registers.forEach((r) => {
    rows.push([
      r.openedAt ? new Date(r.openedAt).toLocaleString() : "",
      r.closedAt ? new Date(r.closedAt).toLocaleString() : "",
      r.status,
      r.openingFloat,
      r.closingCash,
      r.salesCount,
      r.grossSales,
      r.cashSales,
      r.mpesaSales,
    ]);
  });

  // Convert to CSV string
  const csvContent = rows.map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")
  ).join("\n");

  // Create download
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `daily-register-report-${report.date}.csv`;
  link.click();

  URL.revokeObjectURL(url);
};
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-4">
     <div className="flex items-center justify-between gap-3">
  <h1 className="text-2xl font-bold">Daily Register Report</h1>

  <div className="flex gap-2">
    <Button color="light" onClick={() => fetchReport()} disabled={loading}>
      {loading ? <Spinner size="sm" /> : "Refresh"}
    </Button>

    <Button
      color="success"
      onClick={downloadCSV}
      disabled={!report}
    >
      Download CSV
    </Button>
  </div>
</div>

      {error && <Alert color="failure">{error}</Alert>}

      {/* FILTERS */}
      <div className="bg-white dark:bg-gray-800 border rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <Label value="Date (YYYY-MM-DD)" />
            <TextInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          <div>
            <Label value="Cashier ID (optional)" />
            <TextInput
              value={cashierId}
              onChange={(e) => setCashierId(e.target.value)}
              placeholder="Leave blank to use current user"
            />
          </div>

          <Button
            onClick={() => fetchReport(date, cashierId)}
            disabled={loading}
            className="w-full md:w-auto"
          >
            {loading ? <Spinner size="sm" /> : "Run Report"}
          </Button>
        </div>
      </div>

      {!report && !loading ? (
        <div className="text-sm text-gray-500">Run report to view results.</div>
      ) : null}

      {/* SUMMARY */}
      {report && (
        <>
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
              <div className="text-sm">
                Expected: <b>{money(report.cashReconciliation?.expectedCash)}</b>
              </div>
              <div className="text-sm">
                Counted: <b>{money(report.cashReconciliation?.countedCash)}</b>
              </div>
              <div className="text-sm">
                Variance: {varianceBadge(report.cashReconciliation?.variance)}
              </div>
            </Card>
          </div>

          {/* REGISTERS LIST */}
          <div className="bg-white dark:bg-gray-800 border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">Registers</h2>
              <div className="text-sm text-gray-500">
                {report.registers?.length || 0} record(s)
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
                    <Table.Row key={r._id}>
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
        </>
      )}
    </div>
  );
}