// src/components/ProtectedRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";

export default function ProtectedRoute({ children }) {
  const user = JSON.parse(localStorage.getItem("colibri:user"));

  if (!user) {
    // 🚫 Forzar borrado de caché para prevenir navegación atrás
    window.history.pushState(null, "", window.location.href);
    window.onpopstate = () => {
      window.history.go(1);
    };
    return <Navigate to="/" replace />;
  }

  return children;
}
