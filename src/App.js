// src/App.js
import React from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";

import DashboardLayout from "./layouts/DashboardLayout";
import Login from "./pages/Login";
import HomePasajero from "./pages/HomePasajero225";
import HomeConductor from "./pages/HomeConductor";
import BusquedaRutas from "./pages/pasajero/BusquedaRutas";
import MapaRutas from "./pages/pasajero/MapaRutas";
import HistorialViajes from "./pages/pasajero/HistorialViajes";
import PerfilPasajero from "./pages/pasajero/PerfilPasajero";
import Billetera from "./pages/pasajero/Billetera";
import SolicitarViaje from "./pages/pasajero/SolicitarViaje";
import Rol from "./pages/Rol";
import Registro from "./pages/Registro";

/**
 * Redirige /pasajero -> /pasajero/:userId si existe en localStorage,
 * si no hay sesión te manda a "/".
 */
function PasajeroRedirect() {
  try {
    const raw = localStorage.getItem("colibri:user");
    const user = raw ? JSON.parse(raw) : null;
    if (user?.id) return <Navigate to={`/pasajero/${user.id}`} replace />;
  } catch {}
  return <Navigate to="/" replace />;
}

/**
 * Redirige /conductor -> /conductor/:userId si existe en localStorage,
 * si no hay sesión te manda a "/".
 */
function ConductorRedirect() {
  try {
    const raw = localStorage.getItem("colibri:user");
    const user = raw ? JSON.parse(raw) : null;
    if (user?.id) return <Navigate to={`/conductor/${user.id}`} replace />;
  } catch {}
  return <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Inicio / Auth */}
        <Route path="/" element={<Login />} />
        <Route path="/Rol" element={<Rol />} />
        <Route path="/Registro" element={<Registro />} />

        {/* ========= PASAJERO ========= */}
        {/* Redirige si falta :userId pero sí hay sesión */}
        <Route path="/pasajero" element={<PasajeroRedirect />} />

        <Route
          path="/pasajero/:userId"
          element={
            <DashboardLayout>
              <HomePasajero />
            </DashboardLayout>
          }
        />
        <Route
          path="/pasajero/:userId/busqueda"
          element={
            <DashboardLayout>
              <BusquedaRutas />
            </DashboardLayout>
          }
        />
        <Route
          path="/pasajero/:userId/mapa"
          element={
            <DashboardLayout>
              <MapaRutas />
            </DashboardLayout>
          }
        />
        <Route
          path="/pasajero/:userId/solicitar-viaje"
          element={
            <DashboardLayout>
              <SolicitarViaje />
            </DashboardLayout>
          }
        />
        <Route
          path="/pasajero/:userId/historial"
          element={
            <DashboardLayout>
              <HistorialViajes />
            </DashboardLayout>
          }
        />
        <Route
          path="/pasajero/:userId/billetera"
          element={
            <DashboardLayout>
              <Billetera />
            </DashboardLayout>
          }
        />
        <Route
          path="/pasajero/:userId/perfil"
          element={
            <DashboardLayout>
              <PerfilPasajero />
            </DashboardLayout>
          }
        />

        {/* ========= CONDUCTOR ========= */}
        {/* Redirige si falta :userId pero sí hay sesión */}
        <Route path="/conductor" element={<ConductorRedirect />} />

        {/* Si tu HomeConductor ya incluye su propio layout, déjalo así.
           Si quieres que use DashboardLayout, envuélvelo igual que pasajero. */}
        <Route path="/conductor/:userId" element={<HomeConductor />} />


        {/* 404 opcional */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
