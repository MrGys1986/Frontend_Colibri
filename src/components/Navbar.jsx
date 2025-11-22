// src/components/Navbar.jsx
import React from "react";
import "../styles/navbar.css";

export default function Navbar({ user, onLogout, toggleSidebar }) {
  return (
    <header className="navbar">
      <button className="menu-btn" onClick={toggleSidebar}>≡</button>
      <h1>🕊️ Plataforma Colibrí</h1>
      <div className="navbar-user">
        <span>{user.email}</span>
        <button onClick={onLogout}>Cerrar sesión</button>
      </div>
    </header>
  );
}
