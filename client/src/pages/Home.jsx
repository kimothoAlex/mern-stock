import React, { useState, useEffect } from "react";
import { app } from "../fierbase";
import { getStorage, ref, getDownloadURL } from "firebase/storage";
const Home = () => {
  const [imageUrl, setImageUrl] = useState(null);
  useEffect(() => {
    const storage = getStorage(app);
    const fileRef = ref(storage, "gs://mern-stock.appspot.com/MMinimart.jpeg"); // Replace with your file path

    getDownloadURL(fileRef)
      .then((url) => {
        setImageUrl(url);
      })
      .catch((error) => {
        console.error("Error getting download URL:", error);
      });
  }, []);
  return <img className=" w-full h-screen " src={imageUrl} alt="" />;
};

export default Home;
