// src/components/Sidebar.jsx
import React, { useEffect, useMemo, useState } from "react";
import "../styles/sidebar.css";
import { useNavigate, useLocation } from "react-router-dom";
import { AuthClient } from "../lib/authClient";


export default function Sidebar({ onSelect, sidebarOpen }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState(null);

  // Carga usuario o regresa a login si no existe
useEffect(() => {
  try {
    if (AuthClient && typeof AuthClient.normalizeTokensStorage === "function") {
      AuthClient.normalizeTokensStorage();
    }
  } catch (err) {
    console.error("Error al normalizar tokens:", err);
  }

  const stored = localStorage.getItem("colibri:user");
  if (stored) setUser(JSON.parse(stored));
  else navigate("/", { replace: true });
}, [navigate]);


  // Tipo de usuario
  const userType = useMemo(() => {
    if (user?.role === "Usuario" || user?.role === 1) return "pasajero";
    if (user?.role === "Conductor" || user?.role === 3) return "conductor";
    return "desconocido";
  }, [user]);

  const uid = user?.id;

  // Sección actual (para conductor). Persistimos en sessionStorage.
  const currentSection = useMemo(() => {
    const fromState = location.state?.section;
    if (fromState) {
      sessionStorage.setItem("conductor:section", fromState);
      return fromState;
    }
    const sp = new URLSearchParams(location.search);
    const fromQuery = sp.get("s");
    if (fromQuery) {
      sessionStorage.setItem("conductor:section", fromQuery);
      return fromQuery;
    }
    const fromSession = sessionStorage.getItem("conductor:section");
    return fromSession || "rutas";
  }, [location.state?.section, location.search]);

  // Normaliza rutas SIN :id (solo si es necesario)
  useEffect(() => {
    if (!uid) return;

    const path = location.pathname;
    const sp = new URLSearchParams(location.search);
    const qsSection = sp.get("s");
    const isPasajeroRoute = path.startsWith("/pasajero");
    const isConductorRoute = path.startsWith("/conductor");

    if (userType === "pasajero") {
      const desiredPrefix = `/pasajero/${uid}`;
      if (!isPasajeroRoute || !path.startsWith(desiredPrefix)) {
        navigate(`/pasajero/${uid}/busqueda`, { replace: true });
      }
      return;
    }

    if (userType === "conductor") {
      const desiredBase = `/conductor/${uid}`;

      if (!isConductorRoute || !path.startsWith(desiredBase)) {
        navigate(`${desiredBase}?s=${currentSection}`, {
          replace: true,
          state: { section: currentSection },
        });
        return;
      }

      if (!qsSection) {
        navigate(`${desiredBase}?s=${currentSection}`, {
          replace: true,
          state: { section: currentSection },
        });
        return;
      }

      sessionStorage.setItem("conductor:section", qsSection);
      return;
    }
  }, [userType, uid, location.pathname, location.search, navigate, currentSection]);

  // Opciones por rol (CON id)
  const opcionesPasajero = uid
    ? [
        { icon: "🏠", label: "Inicio",          path: `/pasajero/${uid}` },
        { icon: "🗺️", label: "Ver Mapa",        path: `/pasajero/${uid}/mapa` },
        { icon: "📋", label: "Mis Viajes",          path: `/pasajero/${uid}/historial` },
        { icon: "💰", label: "Mi Billetera",       path: `/pasajero/${uid}/billetera` },
        { icon: "👤", label: "Mi Perfil",       path: `/pasajero/${uid}/perfil` },
      ]
    : [];

  const opcionesConductor = uid
    ? [
        { icon: "🚗", label: "Mis Rutas",        path: `/conductor/${uid}`, section: "rutas" },
        { icon: "📋", label: "Mis Viajes",        path: `/conductor/${uid}`, section: "historial" },
        { icon: "💰", label: "Mi Billetera",        path: `/conductor/${uid}`, section: "notificaciones" },
        { icon: "👤", label: "Mi Perfil",        path: `/conductor/${uid}`, section: "perfil" },
      ]
    : [];

  const opciones =
    userType === "conductor" ? opcionesConductor :
    userType === "pasajero" ? opcionesPasajero : [];

  // Helper para comparar paths sin barra final
  const normalize = (p = "") => p.replace(/\/+$/, "");
  const pathNow = normalize(location.pathname);
  const pasajeroBase = uid ? normalize(`/pasajero/${uid}`) : "";

  // Cerrar sesión
  const handleLogout = () => {
  localStorage.removeItem("colibri:user");
  localStorage.removeItem("colibri:access_token");
  localStorage.removeItem("colibri:refresh_token");
  localStorage.removeItem("colibri:token");
  localStorage.removeItem("colibri:refresh");
  sessionStorage.removeItem("conductor:section");
  navigate("/", { replace: true });
};

  // Navegación (para conductor mando state.section y query ?s=)
  const handleNavigation = (op) => {
    if (userType === "conductor") {
      const section = op.section || "rutas";
      sessionStorage.setItem("conductor:section", section);

      const base = op.path; // siempre /conductor/:uid
      const sp = new URLSearchParams(location.search);
      const currentS = sp.get("s");

      if (location.pathname === base && currentS === section) {
        onSelect?.();
        return;
      }

      const url = `${base}?s=${section}`;
      navigate(url, { state: { section } });
    } else {
      navigate(op.path);
    }
    onSelect?.();
  };

  return (
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      {user && (
        <div className="conductor-profile">
          <div className="profile-image"><span className="profile-icon">👤</span></div>
          <div className="profile-info">
            <h3>{user.full_name || "Usuario"}</h3>
            <p className="email">{user.email}</p>
            <span className="status online">{userType}</span>
          </div>
        </div>
      )}

      <nav className="sidebar-menu">
        {opciones.map((op) => {
          let isActive = false;

          if (userType === "conductor") {
            isActive = (op.section === currentSection);
          } else {
            // Pasajero: "Inicio" solo si es EXACTAMENTE el base
            const target = normalize(op.path);
            if (target === pasajeroBase) {
              isActive = (pathNow === pasajeroBase);
            } else {
              // otras opciones: exacto o con subruta
              isActive = (pathNow === target) || pathNow.startsWith(`${target}/`);
            }
          }

          return (
            <button
              key={`${op.path}|${op.section || op.label}`}
              className={`sidebar-item ${isActive ? "active" : ""}`}
              onClick={() => handleNavigation(op)}
            >
              <span className="icon">{op.icon}</span>
              {op.label}
            </button>
          );
        })}

        <div className="sidebar-footer">
          <button className="logout-btn" onClick={handleLogout}>🚪 Cerrar sesión</button>
        </div>
      </nav>
    </aside>
  );
}
