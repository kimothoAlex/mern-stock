import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import DashSidebar from "../components/DashSidebar";
import DashProfile from "../components/DashProfile";
import DashProducts from "../components/DashProducts";
import DashSales from "../components/DashSales";
import DashboardComp from "../components/DashboardComp";

const Dashboard = () => {
  const location = useLocation();
  const [tab, setTab] = useState("");
  useEffect(() => {
    const urlParams = new URLSearchParams(location.search);
    const tabFromUrl = urlParams.get("tab");
    if (tabFromUrl) {
      setTab(tabFromUrl);
    }
  }, [location.search]);
  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      <div className="md:w-56">
        {/*SideBar*/}
        <DashSidebar />
      </div>
      {/*Profile*/}
      {tab === "profile" && <DashProfile />}
      {/*Posts*/}

      {/* products... */}
      {tab === "products" && <DashProducts />}
      {/* sales... */}
      {tab === "sales" && <DashSales />}
      {/* dashboard comp */}
      {tab === "dash" && <DashboardComp />}
    </div>
  );
};

export default Dashboard;
