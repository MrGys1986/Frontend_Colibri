import React from "react";
import "../styles/header.css";

export default function Header({ toggleSidebar }) {
  const user = JSON.parse(localStorage.getItem("colibri:user"));

  return (
    <>
      {/* ==== HEADER FIJO ==== */}
      <header className="header">
        <div className="header-left">
          {/* Botón del menú lateral */}
          <button className="menu-btn" onClick={toggleSidebar} aria-label="Abrir menú">
            ☰
          </button>

          {/* Logo + Título */}
          <div className="header-title">
            {/* Imagen del colibrí (no ícono) */}
            <img src="/colibri.png" alt="Logo Colibrí" className="logo-img" />
            <h1>
              Plataforma <span>Colibrí</span>
            </h1>
          </div>
        </div>

        {/* Email del usuario */}
        <div className="header-right">
          {user?.email && (
            <span className="user-email" title={user.email}>
              {user.email}
            </span>
          )}
        </div>
      </header>

      {/* Espacio para evitar que el header tape contenido */}
      <div className="header-spacer" />
    </>
  );
}
