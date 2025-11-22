// src/components/MapaPlaceholder.jsx
import React from "react";

export default function MapaPlaceholder() {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #1C2541, #0B132B)",
        height: "180px",
        borderRadius: "10px",
        color: "#aaa",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      🗺️ Mapa de ubicación (en desarrollo)
    </div>
  );
}
