import { Button, Modal, Table, TextInput, Label, Select } from "flowbite-react";
import React, { useEffect, useState } from "react";
import { HiOutlineExclamationCircle } from "react-icons/hi";
import { useSelector } from "react-redux";
import ThermalReceiptModal from "../components/ThermalReceiptModal"; // adjust path if needed

const readJsonSafe = async (res) => {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return null;
  }
};

const DashSales = () => {
  const { currentUser } = useSelector((state) => state.user);

  const [sales, setSales] = useState([]);
  const [showMore, setShowMore] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [saleIdToDelete, setSaleIdToDelete] = useState("");

  // ✅ receipt preview
  const [openReceipt, setOpenReceipt] = useState(false);
  const [selectedSale, setSelectedSale] = useState(null);
  const [q, setQ] = useState("");
const [methodFilter, setMethodFilter] = useState("ALL"); // ALL | CASH | MPESA
const [dateFrom, setDateFrom] = useState("");
const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await fetch(`/api/sale/getsales`);
        const data = await readJsonSafe(res);

        if (!res.ok) throw new Error(data?.message || "Failed to load sales");

        setSales(data?.sales || []);
        if ((data?.sales || []).length < 9) setShowMore(false);
      } catch (error) {
        console.log(error.message);
      }
    };

    if (currentUser?._id) fetchSales();
  }, [currentUser?._id]);

  const handleShowMore = async () => {
    const startIndex = sales.length;
    try {
      const res = await fetch(`/api/sales/getsales?startIndex=${startIndex}`);
      const data = await readJsonSafe(res);

      if (!res.ok) throw new Error(data?.message || "Failed to load more sales");

      const newOnes = data?.sales || [];
      setSales((prev) => [...prev, ...newOnes]);

      if (newOnes.length < 9) setShowMore(false);
    } catch (error) {
      console.log(error.message);
    }
  };

  const handleDeleteSale = async () => {
    setShowModal(false);
    try {
      const res = await fetch(`/api/sales/deletesale/${saleIdToDelete}`, {
        method: "DELETE",
      });
      const data = await readJsonSafe(res);

      if (!res.ok) {
        console.log(data?.message || "Delete failed");
      } else {
        setSales((prev) => prev.filter((sale) => sale._id !== saleIdToDelete));
      }
    } catch (error) {
      console.log(error.message);
    }
  };

  const openSaleReceipt = (sale) => {
    setSelectedSale(sale);
    setOpenReceipt(true);
  };

  const filteredSales = sales.filter((sale) => {
  const text = q.trim().toLowerCase();
  const date = new Date(sale.dateSold || sale.createdAt || sale.updatedAt || Date.now());

  // method filter
  const method = sale?.payment?.method || "";
  if (methodFilter !== "ALL" && method !== methodFilter) return false;

  // date range filter (optional)
  if (dateFrom) {
    const from = new Date(`${dateFrom}T00:00:00`);
    if (date < from) return false;
  }
  if (dateTo) {
    const to = new Date(`${dateTo}T23:59:59`);
    if (date > to) return false;
  }

  // text search
  if (!text) return true;

  const receiptNo = (sale.receiptNo || "").toLowerCase();
  const itemHit = Array.isArray(sale.items)
    ? sale.items.some((i) => {
        const name = (i.productName || "").toLowerCase();
        const bc = (i.barcode || "").toLowerCase();
        return name.includes(text) || bc.includes(text);
      })
    : false;

  const totalStr = String(sale.total || "").toLowerCase();

  return receiptNo.includes(text) || method.toLowerCase().includes(text) || totalStr.includes(text) || itemHit;
});

  return (
    <div className="table-auto overflow-x-scroll md:mx-auto p-3 scrollbar scrollbar-track-slate-100 scrollbar-thumb-slate-300 dark:scrollbar-track-slate-700 dark:scrollbar-thumb-slate-500">
      {currentUser && sales.length > 0 ? (
        <>
        <div className="mb-4 bg-white dark:bg-gray-800 border rounded-lg p-3">
  <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
    <div className="md:col-span-2">
      <Label value="Search (receipt, item name, barcode, total)" />
      <TextInput
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="e.g. RCT-..., sugar, 123456..."
      />
    </div>

    <div>
      <Label value="Payment Method" />
      <Select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)}>
        <option value="ALL">All</option>
        <option value="CASH">Cash</option>
        <option value="MPESA">M-Pesa</option>
      </Select>
    </div>

    <div className="flex gap-2">
      <div className="flex-1">
        <Label value="From" />
        <TextInput type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
      </div>
      <div className="flex-1">
        <Label value="To" />
        <TextInput type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
      </div>
    </div>

    <div className="md:col-span-4 flex justify-between items-center">
      <p className="text-sm text-gray-500">
        Showing <b>{filteredSales.length}</b> of <b>{sales.length}</b>
      </p>

      <Button
        color="light"
        size="sm"
        onClick={() => {
          setQ("");
          setMethodFilter("ALL");
          setDateFrom("");
          setDateTo("");
        }}
      >
        Clear
      </Button>
    </div>
  </div>
</div>
          <Table hoverable className="shadow-md">
            <Table.Head>
              <Table.HeadCell>Date</Table.HeadCell>
              <Table.HeadCell>Receipt No</Table.HeadCell>
              <Table.HeadCell>Items</Table.HeadCell>
              <Table.HeadCell>Total</Table.HeadCell>
              <Table.HeadCell>Payment</Table.HeadCell>
              <Table.HeadCell>View</Table.HeadCell>
              {/* {currentUser.isAdmin && <Table.HeadCell>Delete</Table.HeadCell>} */}
            </Table.Head>

            {filteredSales.map((sale) => {
              const date = sale.dateSold || sale.createdAt || sale.updatedAt;
              const itemsCount = Array.isArray(sale.items) ? sale.items.length : 0;
              const payMethod = sale?.payment?.method || "—";

              return (
                <Table.Body key={sale._id} className="divide-y">
                  <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      {date ? new Date(date).toLocaleDateString() : "—"}
                    </Table.Cell>

                    <Table.Cell className="font-medium text-gray-900 dark:text-white">
                      {sale.receiptNo || "—"}
                    </Table.Cell>

                    <Table.Cell>{itemsCount}</Table.Cell>

                    <Table.Cell>
                      {Number(sale.total || 0).toLocaleString()}
                    </Table.Cell>

                    <Table.Cell>{payMethod}</Table.Cell>

                    <Table.Cell>
                      <Button size="xs" onClick={() => openSaleReceipt(sale)}>
                        View Receipt
                      </Button>
                    </Table.Cell>

                    {/* {currentUser.isAdmin && (
                      <Table.Cell>
                        <span
                          onClick={() => {
                            setShowModal(true);
                            setSaleIdToDelete(sale._id);
                          }}
                          className="font-medium text-red-500 hover:underline cursor-pointer"
                        >
                          Delete
                        </span>
                      </Table.Cell>
                    )} */}
                  </Table.Row>
                </Table.Body>
              );
            })}
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
        <p>You have no sales yet!</p>
      )}

      {/* ✅ RECEIPT MODAL (your thermal receipt) */}
      <ThermalReceiptModal
        show={openReceipt}
        onClose={() => setOpenReceipt(false)}
        receipt={selectedSale}
      />

      {/* DELETE CONFIRM MODAL */}
      <Modal show={showModal} onClose={() => setShowModal(false)} popup size="md">
        <Modal.Header />
        <Modal.Body>
          <div className="text-center">
            <HiOutlineExclamationCircle className="h-14 w-14 text-gray-400 dark:text-gray-200 mb-4 mx-auto" />
            <h3 className="mb-5 text-lg text-gray-500 dark:text-gray-400">
              Are you sure you want to delete this sale?
            </h3>
            <div className="flex justify-center gap-4">
              <Button onClick={handleDeleteSale} color="failure">
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

export default DashSales;