import React, { useState, useEffect } from "react";
import LastDaySalesReportPDF from "./LastDaySalesReportPdf"; // Import your PDF component
import { Button } from "flowbite-react";
import { PDFDownloadLink } from "@react-pdf/renderer";

const SalesReport = () => {
  const [lastDaySales, setLastDaySales] = useState(null);
  const [lastDayTotalSales, setLastDayTotalSales] = useState(0);

  useEffect(() => {
    const fetchSales = async () => {
      try {
        const response = await fetch("/api/sale/lastDaySales");
        const data = await response.json();
        setLastDaySales(data);
      } catch (error) {
        console.log(error);
      }
    };
    const fetchTotalSales = async () => {
      try {
        const res = await fetch("/api/sale/total/last-day");
        const data = await res.json();
        console.log(data);
        if (res.ok) {
          setLastDayTotalSales(data.total);
        }
      } catch (error) {
        console.log(error);
      }
    };

    fetchSales();
    fetchTotalSales();
    
  }, []);

  return (
    <PDFDownloadLink
      document={
        <LastDaySalesReportPDF
          lastDaySales={lastDaySales}
          totalSales={lastDayTotalSales}
        />
      }
      fileName="Last Day Sales.pdf"
    >
      {({ blob, url, loading, error }) =>
        loading ? "Loading document..." : "Download now!"
      }
    </PDFDownloadLink>
  );
};
export default SalesReport;
