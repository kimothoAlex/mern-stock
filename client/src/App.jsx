import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Header from "./components/Header";
import Home from "./pages/Home";
import Signin from "./pages/Signin";
import Signup from "./pages/Signup";
import PrivateRoute from "./components/PrivateRoute";
import Dashboard from "./pages/Dashboard";
import CreateProduct from "./pages/CreateProduct";
import ProductPage from "./pages/ProductPage";
import UpdateProduct from "./pages/UpdateProduct";
import DailyRegisterReport from "./pages/DailyReports";
import IsAdminPrivateRoute from "./components/IsAdminPrivateRoute";
import Search from "./pages/Search";
import MpesaTransactions from "./pages/MpesaTransactions";
import BarcodeProducts from "./pages/BarcodeProducts";

const App = () => {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<Signin />} />
        <Route path="/sign-up" element={<Signup />} />
        <Route path="/barcode" element={<BarcodeProducts />} />
        <Route path="/mpesa-transactions" element={<MpesaTransactions />} />
        
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-product" element={<CreateProduct />} />
          <Route path="/register-report" element={<DailyRegisterReport />} />
        </Route>
        <Route element={< IsAdminPrivateRoute />} >
          <Route path='/update-product/:productId' element={<UpdateProduct />} />
        </Route>
        <Route path="/product/:productSlug" element={<ProductPage />} />
        <Route path='/search' element={<Search />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
