import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import App from "./App.jsx";
import { store } from "./app/store.js";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <Provider store={store}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 4000,
            style: {
              borderRadius: "10px",
              padding: "12px 14px",
              fontSize: "0.88rem",
              boxShadow: "var(--shadow-md)",
              background: "var(--color-bg-elevated)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border-strong)",
            },
            success: {
              iconTheme: { primary: "#059669", secondary: "#ecfdf5" },
            },
            error: {
              iconTheme: { primary: "#dc2626", secondary: "#fef2f2" },
            },
          }}
        />
      </BrowserRouter>
    </Provider>
  </React.StrictMode>
);
