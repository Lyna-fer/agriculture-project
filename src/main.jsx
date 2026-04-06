// import React from 'react'
// import ReactDOM from 'react-dom/client'
// import App from './App'
// import './styles/global.css'
// ReactDOM.createRoot(document.getElementById('root')).render(
//   <React.StrictMode>
//     <App />
//   </React.StrictMode>
// )
import React from "react";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/global.css";
import ReactDOM from "react-dom/client";
ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
);
