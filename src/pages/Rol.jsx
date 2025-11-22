import React from "react";
import { useNavigate } from "react-router-dom";
import "../styles/rol.css";
import { FaCar, FaUser } from "react-icons/fa";

export default function Rol() {
  const navigate = useNavigate();

  const handleSeleccion = (rol) => {
    // Redirige al registro con el rol elegido
    navigate("/registro", { state: { rol } });
  };

  return (
    <div className="rol-container">
      <div className="rol-card">
        <div className="rol-header">
          <div className="logo-circle">
            <img src="/colibri.png" alt="Logo Colibrí" className="logo-img" />
          </div>
          <h1>Elige tu rol</h1>
          <p>¿Cómo deseas registrarte en Plataforma Colibrí?</p>
        </div>

        <div className="rol-buttons">
          <button
            className="rol-btn conductor"
            onClick={() => handleSeleccion("Conductor")}
          >
            <FaCar /> Soy Conductor
          </button>

          <button
            className="rol-btn cliente"
            onClick={() => handleSeleccion("Cliente")}
          >
            <FaUser /> Soy Cliente
          </button>
        </div>

        <p className="rol-footer">
          ¿Ya tienes cuenta? <a href="/">Inicia sesión</a>
        </p>
      </div>
    </div>
  );
}
