// src/pages/Pasajero.jsx
import React, { useState } from "react";
import "../styles/pasajero.css";

export default function Pasajero() {
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");

  const handleSolicitarViaje = () => {
    if (!origen || !destino) {
      alert("Por favor completa ambos campos.");
      return;
    }
    alert(`Solicitud enviada: ${origen} ➜ ${destino}`);
  };

  return (
    <div className="pasajero-container">
      <h2>¿A dónde vamos?</h2>

      <div className="viaje-form">
        <input
          type="text"
          placeholder="Punto de partida"
          value={origen}
          onChange={(e) => setOrigen(e.target.value)}
        />
        <input
          type="text"
          placeholder="Destino"
          value={destino}
          onChange={(e) => setDestino(e.target.value)}
        />
        <button onClick={handleSolicitarViaje}>Solicitar viaje</button>
      </div>

      <div className="mapa-placeholder">
        <p>🗺️ Mapa de ubicación (en desarrollo)</p>
      </div>

      <div className="info-extra">
        <h3>Destinos frecuentes</h3>
        <div className="destinos">
          <button>Terminal</button>
          <button>Plaza Principal</button>
          <button>Zona Turística</button>
        </div>
      </div>
    </div>
  );
}
