// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "mern-stock.firebaseapp.com",
  projectId: "mern-stock",
  storageBucket: "mern-stock.appspot.com",
  messagingSenderId: "682881844088",
  appId: "1:682881844088:web:6749d3899191171ea0fe8d"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);