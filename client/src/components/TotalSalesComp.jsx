import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS,  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement, } from 'chart.js';
const SalesChart = () => {
  const [salesData, setSalesData] = useState({
    labels: [],
    datasets: [],
  });
  useEffect(() => {
    ChartJS.register( CategoryScale,
      LinearScale,
      PointElement,
      LineElement,
      Title,
      Tooltip,
      Legend,
      ArcElement);
   }, []);
  useEffect(() => {
    const fetchData = async () => {
      const lastDayData = await fetch('/api/sale/total/last-day');
      const lastWeekData = await fetch('/api/sale/total/last-week');
      const lastMonthData = await fetch('/api/sale/total/last-month');

      const lastDaySales = await lastDayData.json();
      const lastWeekSales = await lastWeekData.json();
      const lastMonthSales = await lastMonthData.json();

      // Assuming your API response contains a timestamp field

      const labels = []; // Array to store labels for each period

      // Generate labels for last day (assuming hourly data)
      for (let i = 0; i < 24; i++) {
        const hour = i.toString().padStart(2, '0'); // Format hour with leading zero
        labels.push(`${hour}:00`);
      }

      // Generate labels for last week (assuming daily data)
      const weekStart = new Date(); // Get current date
      weekStart.setDate(weekStart.getDate() - 6); // Go back 6 days (beginning of week)
      for (let i = 0; i < 7; i++) {
        const day = weekStart.getDate().toString().padStart(2, '0');
        const month = (weekStart.getMonth() + 1).toString().padStart(2, '0'); // Month (0-indexed)
        labels.push(`${month}/${day}`);
        weekStart.setDate(weekStart.getDate() + 1); // Move to next day
      }

      // Generate labels for last month (assuming daily data)
      const monthStart = new Date();
      monthStart.setDate(1); // Set to beginning of last month
      for (let i = 0; i < monthStart.getDate(); i++) { // Loop for all days in last month
        const day = i.toString().padStart(2, '0');
        const month = (monthStart.getMonth() + 1).toString().padStart(2, '0');
        labels.push(`${month}/${day}`);
      }

      setSalesData({
        labels,
        datasets: [
          {
            label: 'Last Day',
            data: lastDaySales.total ? [lastDaySales.total] : [], // Handle cases with no sales
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1,
          },
          {
            label: 'Last Week',
            data: lastWeekSales.total ? [lastWeekSales.total] : [], // Handle cases with no sales
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            borderColor: 'rgba(54, 162, 235, 1)',
            borderWidth: 1,
          },
          {
            label: 'Last Month',
            data: lastMonthSales.total ? [lastMonthSales.total] : [], // Handle cases with no sales
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
          },
        ],
      });
    };

    fetchData();
  }, []);

  return (
    <div className="w-full h-64">
      <Line data={salesData} options={{}} />
    </div>
  );
};

export default SalesChart;