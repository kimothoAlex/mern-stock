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

const App = () => {
  return (
    <BrowserRouter>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/sign-in" element={<Signin />} />
        <Route path="/sign-up" element={<Signup />} />
        <Route element={<PrivateRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/create-product" element={<CreateProduct />} />
        </Route>
        <Route path="/product/:productSlug" element={<ProductPage />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
