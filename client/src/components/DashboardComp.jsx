import React, { useEffect, useState } from "react";
import SalesChart from "./TotalSalesComp";
import {
  HiAnnotation,
  HiArrowNarrowUp,
  HiDocumentText,
  HiOutlineUserGroup,
} from "react-icons/hi";

import { useSelector } from "react-redux";
import { Alert, Button, Table } from "flowbite-react";
import { Link } from "react-router-dom";

const DashboardComp = () => {
  const [topSold, setTopSold] = useState([]);
  const [leastSold, setLeastSold] = useState([]);
  const [sales, setSales] = useState([]);
  const [lastDaySales, setLastDaySales] = useState(0);
  const [lastWeekSales, setLastWeekSales] = useState(0);
  const [lastMonthSales, setLastMonthSales] = useState(0);
  const [lastDayTotalSales, setLastDayTotalSales] = useState(0);
  const [lastWeekTotalSales, setLastWeekTotalSales] = useState(0);
  const [lastMonthTotalSales, setLastMonthTotalSales] = useState(0);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const { currentUser } = useSelector((state) => state.user);
  console.log(lowStockProducts);
  useEffect(() => {
    const fetchSales = async () => {
      try {
        const res = await fetch("/api/sale/getsales?limit=5");
        const data = await res.json();
        if (res.ok) {
          setSales(data.sales);
          setLastDaySales(data.lastDaySales);
          setLastWeekSales(data.lastWeekSales);
          setLastMonthSales(data.lastMonthSales);
        }
      } catch (error) {
        console.log(error.message);
      }
    };
    const fetchTotalSales = async () => {
      try {
        const lastDayData = await fetch("/api/sale/total/last-day");
        const lastWeekData = await fetch("/api/sale/total/last-week");
        const lastMonthData = await fetch("/api/sale/total/last-month");

        const lastDayTotalSales = await lastDayData.json();
        if (lastDayData.ok) {
          setLastDayTotalSales(lastDayTotalSales.total);
        }
        const lastWeekTotalSales = await lastWeekData.json();
        if (lastWeekData.ok) {
          setLastWeekTotalSales(lastWeekTotalSales.total);
        }
        const lastMonthTotalSales = await lastMonthData.json();
        if (lastMonthData.ok) {
          setLastMonthTotalSales(lastMonthTotalSales.total);
        }
      } catch (error) {
        console.log(error.message);
      }
    };
    const fetchSaleRanks = async () => {
      try {
        const res = await fetch("/api/product/sales-rank");
        const data = await res.json();
        if (res.ok) {
          setTopSold(data.topSold);
          setLeastSold(data.leastSold);
        }
      } catch (error) {
        console.log(error.message);
      }
    };
    if (currentUser.isAdmin) {
      fetchSales();
      fetchTotalSales();
      fetchSaleRanks();
    }
  }, [currentUser]);

  useEffect(() => {
    const eventSource = new EventSource("http://localhost:5000/stock-updates");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLowStockProducts(data.lowStockProducts);
    };

    return () => eventSource.close(); // Cleanup: Close connection on unmount
  }, []);
  return (
    <div className="p-3 md:mx-auto">
      {lowStockProducts?.map((name) => (
        <Alert className="p-3 mb-3" key={name} onDismiss={() => {}} withBorderAccent>
          <span>
            <span className="font-medium">Low Stock alert!</span> For {name}
          </span>
        </Alert>
      ))}
      <div className="flex-wrap flex gap-4 justify-center">
        <div className="flex flex-col p-3 dark:bg-slate-800 gap-4 md:w-72 w-full rounded-md shadow-md">
          <div className="flex justify-between">
            <div className="">
              <h3 className="text-gray-500 text-md uppercase">Last Day</h3>
              <p className="text-2xl">{lastDaySales}</p>
            </div>
            <HiOutlineUserGroup className="bg-teal-600  text-white rounded-full text-5xl p-3 shadow-lg" />
          </div>
          <div className="flex  gap-2 text-sm">
            <span className="text-green-500 flex items-center">
              <HiArrowNarrowUp />
              {lastDayTotalSales}
            </span>
            <div className="text-gray-500">Last Day Sales</div>
          </div>
        </div>
        <div className="flex flex-col p-3 dark:bg-slate-800 gap-4 md:w-72 w-full rounded-md shadow-md">
          <div className="flex justify-between">
            <div className="">
              <h3 className="text-gray-500 text-md uppercase">Last Week</h3>
              <p className="text-2xl">{lastWeekSales}</p>
            </div>
            <HiAnnotation className="bg-indigo-600  text-white rounded-full text-5xl p-3 shadow-lg" />
          </div>
          <div className="flex  gap-2 text-sm">
            <span className="text-green-500 flex items-center">
              <HiArrowNarrowUp />
              {lastWeekTotalSales}
            </span>
            <div className="text-gray-500">Last Week Sales</div>
          </div>
        </div>
        <div className="flex flex-col p-3 dark:bg-slate-800 gap-4 md:w-72 w-full rounded-md shadow-md">
          <div className="flex justify-between">
            <div className="">
              <h3 className="text-gray-500 text-md uppercase">Last Month</h3>
              <p className="text-2xl">{lastMonthSales}</p>
            </div>
            <HiDocumentText className="bg-lime-600  text-white rounded-full text-5xl p-3 shadow-lg" />
          </div>
          <div className="flex  gap-2 text-sm">
            <span className="text-green-500 flex items-center">
              <HiArrowNarrowUp />
              {lastMonthTotalSales}
            </span>
            <div className="text-gray-500">Last Month Sales</div>
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-4 py-3 mx-auto justify-center">
        <div className="flex flex-col w-full md:w-auto shadow-md p-2 rounded-md dark:bg-gray-800">
          <div className="flex justify-between  p-3 text-sm font-semibold">
            <h1 className="text-center p-2">Recent sales</h1>
            <Button outline gradientDuoTone="purpleToPink">
              <Link to={"/dashboard?tab=sales"}>See all</Link>
            </Button>
          </div>
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Product Name</Table.HeadCell>
              <Table.HeadCell>Quantity</Table.HeadCell>
              <Table.HeadCell>Total Price</Table.HeadCell>
            </Table.Head>
            {sales &&
              sales.map((sale) => (
                <Table.Body key={sale._id} className="divide-y">
                  <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>{sale.productName}</Table.Cell>
                    <Table.Cell>{sale.quantity}</Table.Cell>
                    <Table.Cell>{sale.totalPrice}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              ))}
          </Table>
        </div>
        <div className="flex flex-col w-full md:w-auto shadow-md p-2 rounded-md dark:bg-gray-800">
          <div className="flex justify-between  p-3 text-sm font-semibold">
            <h1 className="text-center p-2">Top Sold</h1>
            <Button outline gradientDuoTone="purpleToPink">
              <Link to={"/dashboard?tab=products"}>See all</Link>
            </Button>
          </div>
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Product Name</Table.HeadCell>
              <Table.HeadCell>Products</Table.HeadCell>
              <Table.HeadCell>Amount Generated</Table.HeadCell>
            </Table.Head>
            {topSold &&
              topSold.map((top) => (
                <Table.Body key={top._id} className="divide-y">
                  <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>
                      <p>{top.productName}</p>
                    </Table.Cell>
                    <Table.Cell>{top.totalSales}</Table.Cell>
                    <Table.Cell>{top.amountGenerated}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              ))}
          </Table>
        </div>
        <div className="flex flex-col w-full md:w-auto shadow-md p-2 rounded-md dark:bg-gray-800">
          <div className="flex justify-between  p-3 text-sm font-semibold">
            <h1 className="text-center p-2">Least Sold</h1>
            <Button outline gradientDuoTone="purpleToPink">
              <Link to={"/dashboard?tab=products"}>See all</Link>
            </Button>
          </div>
          <Table hoverable>
            <Table.Head>
              <Table.HeadCell>Product Name</Table.HeadCell>
              <Table.HeadCell>Products</Table.HeadCell>
              <Table.HeadCell>Amount Generated</Table.HeadCell>
            </Table.Head>
            {leastSold &&
              leastSold.map((least) => (
                <Table.Body key={least._id} className="divide-y">
                  <Table.Row className="bg-white dark:border-gray-700 dark:bg-gray-800">
                    <Table.Cell>{least.productName}</Table.Cell>
                    <Table.Cell>{least.totalSales}</Table.Cell>
                    <Table.Cell>{least.amountGenerated}</Table.Cell>
                  </Table.Row>
                </Table.Body>
              ))}
          </Table>
        </div>
      </div>
    </div>
  );
};

export default DashboardComp;
