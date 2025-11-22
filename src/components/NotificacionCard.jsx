// src/components/NotificacionCard.jsx
import React from "react";

export default function NotificacionCard({ mensaje }) {
  return (
    <div
      style={{
        backgroundColor: "#1C2541",
        color: "#fff",
        padding: "10px",
        borderRadius: "8px",
        marginBottom: "8px",
      }}
    >
      {mensaje}
    </div>
  );
}
