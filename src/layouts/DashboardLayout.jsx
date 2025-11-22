// src/layouts/DashboardLayout.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Header from "../components/Header";
import Sidebar from "../components/Sidebar";
import "../styles/dashboard.css";

export default function DashboardLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modal, setModal] = useState({ open: false, title: "", message: "", kind: "info" });
  const navigate = useNavigate();

  const accessToken = useMemo(
    () => localStorage.getItem("colibri:access_token") || "",
    []
  );
  const user = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("colibri:user") || "{}"); }
    catch { return {}; }
  }, []);

  useEffect(() => {
    if (!accessToken || !user?.id) {
      setModal({
        open: true,
        title: "Sesión requerida",
        message: "Inicia sesión para continuar.",
        kind: "error",
      });
    }
  }, [accessToken, user]);

  const closeAndGoLogin = () => {
    setModal({ open: false, title: "", message: "", kind: "info" });
    navigate("/login", { replace: true });
  };

  return (
    <div className="dashboard">
      {/* Modal del sistema (simple) */}
      {modal.open && (
        <div className="modal-sistema-overlay">
          <div className={`modal-sistema ${modal.kind}`}>
            <h3 className="modal-title">{modal.title}</h3>
            <p className="modal-message">{modal.message}</p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={closeAndGoLogin}>
                Ir a Login
              </button>
            </div>
          </div>
        </div>
      )}

      <Header toggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

      <div className="dashboard-body">
        <Sidebar
          sidebarOpen={sidebarOpen}
          onSelect={() => setSidebarOpen(false)}
        />
        <main className="dashboard-content">
          {/* Si no hay sesión, igual renderizamos el overlay bloqueando interacción */}
          {children}
        </main>
      </div>
    </div>
  );
}
