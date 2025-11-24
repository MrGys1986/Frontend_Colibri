// src/pages/pasajero/MapaRutas.jsx
import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/pasajero/mapaRutas.css";

import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";
import { authClient } from "../../lib/authClient";

const BASE = "https://c-apigateway.onrender.com";

L.Icon.Default.mergeOptions({ iconRetinaUrl: marker2x, iconUrl: marker, shadowUrl: shadow });

// ====== Marcadores ======
const stopIcon = (hex) =>
  L.divIcon({
    className: "cm cm-stop",
    html: `<div class="cm-dot" style="background:${hex}"></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });

const pinIcon = (hex, text) =>
  L.divIcon({
    className: "cm cm-pin",
    html: `
      <div class="pin" style="border-color:${hex}">
        <div class="pin-head" style="background:${hex}">${text}</div>
        <div class="pin-tip" style="border-top-color:${hex}"></div>
      </div>`,
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -28],
  });

// ====== Helpers ======
const toLatLng = ([lng, lat]) => [lat, lng];
const randomDigits = (len = 5) => {
  let out = "";
  const hasWebCrypto = typeof crypto !== "undefined" && crypto.getRandomValues;
  if (hasWebCrypto) {
    const bytes = new Uint8Array(len);
    crypto.getRandomValues(bytes);
    for (let i = 0; i < len; i++) out += (bytes[i] % 10).toString();
    if (out[0] === "0") out = "1" + out.slice(1);
    return out;
  }
  while (out.length < len) out += Math.floor(Math.random() * 10).toString();
  if (out[0] === "0") out = "1" + out.slice(1);
  return out;
};
const uuid = () =>
  typeof crypto?.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random()}`;

// ==========================
// COMPONENTE
// ==========================
export default function MapaRutas() {
  const navigate = useNavigate();

  // Estado general
  const [timeFilter, setTimeFilter] = useState("all");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);
  const [rutas, setRutas] = useState([]);
  const [reservando, setReservando] = useState(false); // Nuevo estado para el cargador de reserva

  // Modal/selección
  const [seleccionada, setSeleccionada] = useState(null);
  const [suboEn, setSuboEn] = useState(0);
  const [bajoEn, setBajoEn] = useState(1);
  const [seatsWanted, setSeatsWanted] = useState(1);
  const [mostrandoModal, setMostrarModal] = useState(false);

  // Modal de éxito
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [successCode, setSuccessCode] = useState("");

  // Toasts
  const [toast, setToast] = useState({ type: "info", msg: "", show: false });
  const showToast = (type, msg, ms = 2600) => {
    setToast({ type, msg, show: true });
    setTimeout(() => setToast((t) => ({ ...t, show: false })), ms);
  };

  // Colores
  const colores = useMemo(
    () => [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf",
    ],
    []
  );

  // ==========================
  // SISTEMA DE PRECIOS
  // ==========================
  const buildSegments = (ruta) => {
    if (!ruta?.prices || !Array.isArray(ruta.prices)) return [];
    const nSeg = Math.max(0, (ruta.points?.length || 0) - 1);
    const arr = ruta.prices.map((x) => Number(x) || 0);
    if (arr.length === nSeg) return arr;
    if (arr.length > nSeg) return arr.slice(0, nSeg);
    return [...arr, ...Array(nSeg - arr.length).fill(0)];
  };

  const calcPrecio = (ruta, iInicio, iFin) => {
    const segs = buildSegments(ruta);
    if (iFin <= iInicio) return 0;
    let total = 0;
    for (let i = iInicio; i < iFin; i++) total += segs[i] || 0;
    return Math.round(total * 100) / 100;
  };

  const totalRuta = (ruta) => {
    const segs = buildSegments(ruta);
    return Math.round(segs.reduce((a, b) => a + b, 0) * 100) / 100;
  };

  // ==========================
  // Auth helpers (solo user)
  // ==========================
  const getStored = () => {
    const rawUserLS = localStorage.getItem("colibri:user");
    const rawUserSS = sessionStorage.getItem("colibri:user");

    let user = {};
    try {
      user = rawUserLS
        ? JSON.parse(rawUserLS)
        : rawUserSS
        ? JSON.parse(rawUserSS)
        : {};
    } catch {}
    return { user };
  };

  // Helper para peticiones con token usando authClient
  const fetchJSONWithAuth = (url, options = {}, opts = { retryOn401: true }) =>
    authClient.fetch(url, options, opts);

  // ==========================
  // Datos conductor + reverse geocoding
  // ==========================
  const driverCache = useMemo(() => new Map(), []);

  const fetchDriverInfo = async (driverId) => {
    if (!driverId)
      return { driverName: "Conductor", driverRating: 4.8, driverRatingDisplay: null };
    if (driverCache.has(driverId)) return driverCache.get(driverId);

    let name = "Conductor";
    let rating = null;

    try {
      // Usuario (puede requerir Bearer según tu auth)
      const userRes = await fetchJSONWithAuth(
        `${BASE}/auth/user/${encodeURIComponent(driverId)}`,
        { method: "GET" }
      );
      if (userRes.ok) {
        const userData = await userRes.json().catch(() => ({}));
        name =
          userData?.full_name ||
          userData?.user?.full_name ||
          userData?.name ||
          "Conductor";
      }
    } catch {}

    try {
      const drvRes = await fetchJSONWithAuth(
        `${BASE}/users/drivers/${encodeURIComponent(driverId)}`,
        { method: "GET" }
      );
      if (drvRes.ok) {
        const driverData = await drvRes.json().catch(() => ({}));
        rating =
          driverData?.rating_avg ??
          driverData?.driver?.rating_avg ??
          driverData?.profile?.rating_avg ??
          driverData?.driver_profile?.rating_avg ??
          driverData?.rating ??
          null;

        if (name === "Conductor") {
          name =
            driverData?.user?.full_name ||
            driverData?.full_name ||
            driverData?.name ||
            "Conductor";
        }
      }
    } catch {}

    const cleanRating = Number(rating);
    const ratingForDisplay =
      Number.isFinite(cleanRating) && cleanRating > 0 ? cleanRating : null;
    const ratingForInternal = ratingForDisplay ?? 4.8;

    const driverInfo = {
      driverName: name,
      driverRating: ratingForInternal,
      driverRatingDisplay: ratingForDisplay,
    };
    driverCache.set(driverId, driverInfo);
    return driverInfo;
  };

  const reverseCache = useMemo(() => new Map(), []);
  const lastGeoRef = useRef(0);

  const waitForRateLimit = async () => {
    const now = Date.now();
    const delta = now - lastGeoRef.current;
    const wait = delta >= 1100 ? 0 : 1100 - delta;
    if (wait) await new Promise((r) => setTimeout(r, wait));
    lastGeoRef.current = Date.now();
  };

  const compactLabelFromNominatim = (j) => {
    const a = j?.address || {};
    const line1 =
      a.road ||
      a.pedestrian ||
      a.cycleway ||
      a.path ||
      a.residential ||
      j?.name;
    const area =
      a.suburb ||
      a.neighbourhood ||
      a.village ||
      a.town ||
      a.city ||
      a.municipality ||
      a.state_district;
    if (line1 && area) return `${line1}, ${area}`;
    if (j?.name) return j.name;
    if (j?.display_name) {
      const parts = j.display_name.split(",").map((s) => s.trim());
      return parts.slice(0, 2).join(", ");
    }
    return null;
  };

  const reverseName = async (lat, lng) => {
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (reverseCache.has(key)) return reverseCache.get(key);
    try {
      await waitForRateLimit();
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&email=soporte@colibri.local`;
      const res = await fetch(url, { headers: { "Accept-Language": "es" } });
      if (res.ok) {
        const data = await res.json();
        const label = compactLabelFromNominatim(data);
        if (label) {
          reverseCache.set(key, label);
          return label;
        }
      }
    } catch {}
    const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    reverseCache.set(key, fallback);
    return fallback;
  };

  // ==========================
  // Enriquecer ruta
  // ==========================
  const enrichRuta = async (raw, idx) => {
    const origin = raw.origin?.coordinates ? toLatLng(raw.origin.coordinates) : null;
    const stops = Array.isArray(raw.stops)
      ? raw.stops.map((s) => toLatLng(s.coordinates))
      : [];
    const destination = raw.destination?.coordinates
      ? toLatLng(raw.destination.coordinates)
      : null;
    const points = [origin, ...stops, destination].filter(Boolean);
    const schedule = raw.schedule ? new Date(raw.schedule) : null;
    const color = colores[idx % colores.length];

    const driver = await fetchDriverInfo(raw.driverId);

    const [oLbl, ...stopLbls] = await Promise.all(
      [origin, ...stops].map((pt) => reverseName(pt[0], pt[1]))
    );
    const dLbl = destination
      ? await reverseName(destination[0], destination[1])
      : "Destino";

    const ruta = {
      ...raw,
      ...driver,
      scheduleDate: schedule,
      points,
      color,
      originLabel: raw.originLabel || oLbl || "Inicio",
      stopLabels: raw.stopLabels || stopLbls || [],
      destinationLabel: raw.destinationLabel || dLbl || "Destino",
    };

    ruta.total = totalRuta(ruta);
    return ruta;
  };

  // ==========================
  // Carga inicial de rutas
  // ==========================
  useEffect(() => {
    let mounted = true;
    (async () => {
      setCargando(true);
      setError(null);
      try {
        const nowIso = new Date().toISOString();
        const url = `${BASE}/api/routes/search?status=available&after=${encodeURIComponent(
          nowIso
        )}`;

        // AHORA con authClient para mandar Bearer + refresh
        const resp = await authClient.fetch(url, {
          headers: { "content-type": "application/json" },
        });
        if (resp.status === 401) {
          if (mounted) {
            setError("Tu sesión ha expirado. Vuelve a iniciar sesión.");
          }
          return;
        }
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

        const data = await resp.json();
        const arr = Array.isArray(data)
          ? data
          : Array.isArray(data?.items)
          ? data.items
          : [];

        const enr = await Promise.all(arr.map((r, i) => enrichRuta(r, i)));

        const now = Date.now();
        const futuras = enr.filter(
          (r) => r.scheduleDate && r.scheduleDate.getTime() > now
        );
        if (mounted)
          setRutas(futuras.sort((a, b) => a.scheduleDate - b.scheduleDate));
      } catch (e) {
        console.error(e);
        if (mounted)
          setError("No se pudieron cargar las rutas. Intenta nuevamente.");
      } finally {
        if (mounted) setCargando(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [colores]);

  // ==========================
  // Filtro por tiempo
  // ==========================
  const rutasFiltradas = useMemo(() => {
    const now = new Date();
    let from = now,
      to = null;
    if (timeFilter === "1h") to = new Date(now.getTime() + 60 * 60 * 1000);
    else if (timeFilter === "2h")
      to = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    else if (timeFilter === "tomorrow") {
      const t0 = new Date(now);
      t0.setDate(now.getDate() + 1);
      t0.setHours(0, 0, 0, 0);
      const t1 = new Date(t0);
      t1.setHours(23, 59, 59, 999);
      from = t0;
      to = t1;
    }
    return rutas.filter((r) => {
      const t = r.scheduleDate?.getTime?.() ?? 0;
      if (!t) return false;
      if (timeFilter === "tomorrow")
        return t >= from.getTime() && t <= to.getTime();
      if (timeFilter === "all") return t >= from.getTime();
      return t >= from.getTime() && t <= to?.getTime();
    });
  }, [rutas, timeFilter]);

  // Modal selección
  const openModal = (ruta) => {
    const lastIdx = Math.max(1, (ruta?.points?.length ?? 2) - 1);
    setSeleccionada(ruta);
    setSuboEn(0);
    setBajoEn(lastIdx);
    setSeatsWanted(1);
    setMostrarModal(true);
  };
  const closeModal = () => {
    setMostrarModal(false);
    setSeleccionada(null);
  };

  const priceSeleccion = useMemo(() => {
    if (!seleccionada?.points?.length) return 0;
    return calcPrecio(seleccionada, suboEn, bajoEn);
  }, [seleccionada, suboEn, bajoEn]);

  const maxSeats = useMemo(
    () => Number(seleccionada?.availableSeats || 0),
    [seleccionada]
  );
  const totalPagar = useMemo(
    () => Math.max(0, priceSeleccion * seatsWanted),
    [priceSeleccion, seatsWanted]
  );

  // ==========================
  // Confirmar reserva
  // ==========================
  const confirmReserva = async () => {
    if (!seleccionada) return;
    
    // Activar cargador
    setReservando(true);
    
    const { user } = getStored();
    const passengerId = user?.id || user?.userId || user?.uid || user?.sub;
    if (!passengerId) {
      showToast("error", "No se encontró el usuario autenticado.");
      setReservando(false);
      return;
    }

    if (bajoEn <= suboEn) {
      showToast("error", "Selecciona un tramo válido.");
      setReservando(false);
      return;
    }
    if (seatsWanted < 1) {
      showToast("error", "El mínimo es 1 asiento.");
      setReservando(false);
      return;
    }
    if (seatsWanted > maxSeats) {
      showToast("error", "No hay tantos asientos disponibles.");
      setReservando(false);
      return;
    }

    try {
      // 0) Validar billetera
      const accRes = await fetchJSONWithAuth(
        `${BASE}/api/wallet/accounts/${passengerId}`,
        { method: "GET" }
      );
      if (accRes.status === 401) throw new Error("Sesión expirada.");
      if (!accRes.ok) throw new Error("No se pudo validar la billetera.");
      const acc = await accRes.json();
      const balance = Number(acc?.balance_cents || 0);
      const hold = Number(acc?.hold_cents || 0);
      const available = Math.max(0, balance - hold);
      const amountToHold = Math.round(totalPagar * 100);

      if (available < amountToHold) {
        const faltante = ((amountToHold - available) / 100).toFixed(2);
        showToast("error", `Fondos insuficientes. Te faltan $${faltante} MXN.`);
        setReservando(false);
        return;
      }

      // 1) Crear reserva
      const code = randomDigits(5);
      const createBody = {
        routeId: seleccionada._id || seleccionada.id,
        driverId: seleccionada.driverId,
        passengerId,
        seats: seatsWanted,
        price: totalPagar,
        status: "PENDING",
        pickupAt: seleccionada.scheduleDate
          ? seleccionada.scheduleDate.toISOString()
          : null,
        notes: `Tramo: ${suboEn} -> ${bajoEn}`,
        code,
      };

      const resCreate = await fetchJSONWithAuth(
        `${BASE}/api/reservations`,
        {
          method: "POST",
          body: JSON.stringify(createBody),
        }
      );
      if (!resCreate.ok) {
        const err = await resCreate.text();
        throw new Error(`No se pudo crear la reserva: ${err}`);
      }
      const reserva = await resCreate.json();

      // 2) HOLD en wallet
      const holdBody = {
        operation_id: uuid(),
        user_id: passengerId,
        amount_cents: amountToHold,
        currency: "MXN",
        reservation_id: reserva.id || reserva.reservation_id || reserva.uuid,
      };
      const resHold = await fetchJSONWithAuth(`${BASE}/api/wallet/hold`, {
        method: "POST",
        body: JSON.stringify(holdBody),
      });
      if (!resHold.ok) {
        // revert
        await fetchJSONWithAuth(
          `${BASE}/api/reservations/${reserva.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({ status: "CANCELLED" }),
          }
        ).catch(() => {});
        const err = await resHold.text();
        throw new Error(`No se pudo retener el dinero: ${err}`);
      }

      // 3) Actualizar asientos
      const newSeats = Math.max(
        0,
        (seleccionada.availableSeats || 0) - seatsWanted
      );
      await fetchJSONWithAuth(
        `${BASE}/api/routes/${encodeURIComponent(
          seleccionada._id || seleccionada.id
        )}`,
        {
          method: "PUT",
          body: JSON.stringify({ availableSeats: newSeats }),
        }
      ).catch(() => {});

      setMostrarModal(false);
      setReservando(false); // Desactivar cargador

      setSuccessCode(code);
      setSuccessMsg(
        `¡Tu reserva está lista! Comparte este código de 5 dígitos con el conductor para confirmar el abordaje:\n\nCódigo: ${code}`
      );
      setSuccessOpen(true);
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "No se pudo completar la reserva.");
      setReservando(false); // Desactivar cargador en caso de error
    }
  };

  // Centro inicial
  const rutasFiltradasMemo = rutasFiltradas;
  const center = useMemo(() => {
    if (
      rutasFiltradasMemo.length > 0 &&
      rutasFiltradasMemo[0].points?.length
    )
      return rutasFiltradasMemo[0].points[0];
    return [20.588793, -100.389888]; // Qro
  }, [rutasFiltradasMemo]);

  const puntoLabel = (ruta, idx) => {
    if (!ruta?.points?.length) return `Punto ${idx + 1}`;
    if (idx === 0) return ruta.originLabel || "Inicio";
    if (idx === ruta.points.length - 1)
      return ruta.destinationLabel || "Destino";
    const iStop = idx - 1;
    return (ruta.stopLabels && ruta.stopLabels[iStop]) || `Parada ${iStop + 1}`;
  };

  // ==========================
  // UI
  // ==========================
  return (
    <div className="mapa-rutas">
      {/* estilos mínimos para modal de éxito */}
      <style>{`
        .modal-overlay {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          background: rgba(4,10,25,.6); backdrop-filter: blur(2px); padding: 20px;
        }
        .modal-card-ok {
          width: 100%; max-width: 520px;
          border-radius: 16px; padding: 20px;
          background: linear-gradient(180deg, #0E1730 0%, #0A1226 100%);
          border: 1px solid rgba(46, 245, 150, 0.35);
          color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,.4);
          text-align: left;
        }
        .modal-card-ok h3 { margin: 0 0 10px; font-size: 1.25rem; }
        .modal-card-ok pre { white-space: pre-wrap; font-family: inherit; color: #D8E4FF; }
        .modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:12px; }
        .btn { border:none; border-radius:10px; padding:10px 14px; font-weight:700; cursor:pointer; }
        .btn-primary { background:#19C37D; color:#05121F; }
        .alert-no-viajes {
          background: #fff3cd;
          border: 1px solid #ffeaa7;
          color: #856404;
          padding: 12px 16px;
          border-radius: 8px;
          margin: 16px 0;
          text-align: center;
          font-size: 14px;
        }
        .loading-spinner-small {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.3);
          border-top: 2px solid white;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          display: inline-block;
          margin-right: 8px;
        }
        .modal-loading-overlay {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          z-index: 10;
          color: white;
          border-radius: var(--radius-lg);
        }
        .modal-loading-overlay p {
          margin-top: 1rem;
          font-weight: 600;
        }
      `}</style>

      {/* Header */}
      <div className="mapa-header">
        <div className="header-content">
          <h1>Rutas Disponibles</h1>
          <p>Encuentra y reserva tu próximo viaje</p>
        </div>
        <div className="filters-container">
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value)}
            className="time-filter"
          >
            <option value="all">Todas las rutas</option>
            <option value="1h">Próxima hora</option>
            <option value="2h">Próximas 2 horas</option>
            <option value="tomorrow">Mañana</option>
          </select>
        </div>
      </div>

      {/* Leyenda */}
      <div className="legend-fixed">
        <div className="legend-item">
          <span className="legend-pin">S</span> Inicio
        </div>
        <div className="legend-item">
          <span className="legend-dot" /> Paradas
        </div>
        <div className="legend-item">
          <span className="legend-pin">D</span> Destino
        </div>
        <div className="legend-note">Cada ruta tiene un color único</div>
      </div>

      {/* Mapa */}
      <div className="mapa-container">
        {cargando && (
          <div className="estado estado-cargando">
            <div className="loading-spinner"></div>
            Cargando rutas disponibles...
          </div>
        )}
        {error && (
          <div className="estado estado-error">
            <span>⚠️</span>
            {error}
          </div>
        )}

        {!cargando && !error && (
          <>
            {rutasFiltradas.length === 0 && (
              <div className="alert-no-viajes">
                🚗 No se encontraron viajes en este momento. Espera a que se publiquen nuevos viajes.
              </div>
            )}
            <MapContainer
              className="leaflet-map"
              center={center}
              zoom={12}
              scrollWheelZoom
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />

              {rutasFiltradas.map((r, idx) => (
                <React.Fragment key={r._id || r.id || idx}>
                  {r.points?.length >= 2 && (
                    <Polyline
                      positions={r.points}
                      pathOptions={{ color: r.color, weight: 6, opacity: 0.8 }}
                      eventHandlers={{ click: () => openModal(r) }}
                    />
                  )}

                  {r.points?.map((pt, i) => {
                    const isStart = i === 0;
                    const isEnd = i === r.points.length - 1;
                    const icon = isStart
                      ? pinIcon(r.color, "S")
                      : isEnd
                      ? pinIcon(r.color, "D")
                      : stopIcon(r.color);
                    return (
                      <Marker
                        key={`${r._id || idx}-m-${i}`}
                        position={pt}
                        icon={icon}
                        eventHandlers={{ click: () => openModal(r) }}
                      >
                        <Popup className="custom-popup">
                          <div className="popup">
                            <div className="popup-title">
                              {puntoLabel(r, i)}
                            </div>
                            <div className="popup-body">
                              <div>
                                <b>Conductor:</b> {r.driverName}
                              </div>
                              <div>
                                <b>Salida:</b>{" "}
                                {r.scheduleDate
                                  ? r.scheduleDate.toLocaleString("es-MX", {
                                      dateStyle: "medium",
                                      timeStyle: "short",
                                    })
                                  : "-"}
                              </div>
                              <div>
                                <b>Asientos:</b> {r.availableSeats ?? "-"}
                              </div>
                              <div>
                                <b>Precio total:</b> $
                                {r.total?.toFixed(2) || "0.00"}
                              </div>
                            </div>
                            <button
                              className="btn-detalles"
                              onClick={() => openModal(r)}
                            >
                              Ver detalles completos
                            </button>
                          </div>
                        </Popup>
                      </Marker>
                    );
                  })}
                </React.Fragment>
              ))}
            </MapContainer>
          </>
        )}
      </div>

      {/* Lista */}
      <div className="rutas-lista">
        <div className="lista-header">
          <h3>Rutas Disponibles ({rutasFiltradas.length})</h3>
          <div className="lista-stats">
            <span className="stat-total">
              Total: {rutasFiltradas.length} rutas
            </span>
          </div>
        </div>

        {rutasFiltradas.length === 0 && !cargando && (
          <div className="alert-no-viajes">
            🚗 No se encontraron viajes en este momento. Espera a que se publiquen nuevos viajes.
          </div>
        )}

        <div className="rutas-grid">
          {rutasFiltradas.map((r, idx) => (
            <div key={r._id || r.id || idx} className="ruta-card">
              <div className="ruta-header">
                <div className="ruta-badge">
                  Ruta #{String(idx + 1).padStart(2, "0")}
                </div>
                <div className="ruta-price">
                  ${r.total?.toFixed(2) || "0.00"}
                </div>
              </div>

              <div className="driver-info">
                <div className="driver-name-rating">
                  <span className="driver-name">{r.driverName}</span>
                  <span className="driver-rating">
                    ⭐{" "}
                    {r.driverRatingDisplay == null
                      ? "Nuevo"
                      : Number(r.driverRatingDisplay).toFixed(1)}
                  </span>
                </div>
              </div>

              <div className="ruta-timeline">
                <div
                  className="timeline-line"
                  style={{ background: r.color }}
                ></div>
                <div className="timeline-stops">
                  <div className="timeline-stop start">
                    <div
                      className="stop-marker"
                      style={{ background: r.color }}
                    ></div>
                    <div className="stop-info">
                      <span className="stop-time">
                        {r.scheduleDate?.toLocaleTimeString("es-MX", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="stop-name">{r.originLabel}</span>
                    </div>
                  </div>

                  {r.stopLabels?.map((stop, stopIdx) => (
                    <div
                      key={stopIdx}
                      className="timeline-stop intermediate"
                    >
                      <div
                        className="stop-marker"
                        style={{ background: r.color }}
                      ></div>
                      <div className="stop-info">
                        <span className="stop-name">{stop}</span>
                      </div>
                    </div>
                  ))}

                  <div className="timeline-stop end">
                    <div
                      className="stop-marker"
                      style={{ background: r.color }}
                    ></div>
                    <div className="stop-info">
                      <span className="stop-name">
                        {r.destinationLabel}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="ruta-footer">
                <div className="ruta-meta">
                  <span className="meta-item">
                    🕒{" "}
                    {r.scheduleDate?.toLocaleDateString("es-MX", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                  <span className="meta-item">
                    💺 {r.availableSeats} asientos
                  </span>
                </div>
                <button
                  className="btn-ver-detalles"
                  onClick={() => openModal(r)}
                >
                  Reservar ahora
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de detalles */}
      {mostrandoModal && seleccionada && (
        <div className="modal-backdrop" onClick={closeModal}>
          {/* Overlay de carga durante reserva */}
          {reservando && (
            <div className="modal-loading-overlay">
              <div className="loading-spinner"></div>
              <p>Procesando reserva...</p>
            </div>
          )}
          
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles de la Ruta</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
              <div className="modal-map-section">
                <div className="map-container-mini">
                  <MapContainer
                    className="leaflet-mini"
                    center={seleccionada.points?.[0] ?? center}
                    zoom={12}
                    scrollWheelZoom={false}
                  >
                    <TileLayer
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    {seleccionada.points?.length >= 2 && (
                      <Polyline
                        positions={seleccionada.points}
                        pathOptions={{
                          color: seleccionada.color,
                          weight: 5,
                          opacity: 0.9,
                        }}
                      />
                    )}
                    {seleccionada.points?.map((pt, i) => {
                      const isStart = i === 0;
                      const isEnd =
                        i === seleccionada.points.length - 1;
                      const icon = isStart
                        ? pinIcon(seleccionada.color, "S")
                        : isEnd
                        ? pinIcon(seleccionada.color, "D")
                        : stopIcon(seleccionada.color);
                      return (
                        <Marker key={`sel-m-${i}`} position={pt} icon={icon}>
                          <Popup>{puntoLabel(seleccionada, i)}</Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              </div>

              <div className="modal-info-section">
                <div className="info-grid">
                  <div className="info-item">
                    <label>Conductor</label>
                    <span>{seleccionada.driverName}</span>
                  </div>
                  <div className="info-item">
                    <label>Calificación</label>
                    <span className="rating-display">
                      ⭐{" "}
                      {seleccionada.driverRatingDisplay == null
                        ? "Nuevo"
                        : Number(
                            seleccionada.driverRatingDisplay
                          ).toFixed(1)}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Fecha y hora</label>
                    <span>
                      {seleccionada.scheduleDate
                        ? seleccionada.scheduleDate.toLocaleString(
                            "es-MX",
                            {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )
                        : "—"}
                    </span>
                  </div>
                  <div className="info-item full-width">
                    <label>Asientos disponibles</label>
                    <span>{seleccionada.availableSeats} asientos</span>
                  </div>
                </div>

                <div className="route-summary">
                  <h4>Recorrido</h4>
                  <div className="stops-list">
                    <div className="stop-item start">
                      <div className="stop-marker"></div>
                      <div className="stop-details">
                        <strong>Inicio:</strong>{" "}
                        {seleccionada.originLabel}
                      </div>
                    </div>
                    {seleccionada.stopLabels?.map((stop, idx) => (
                      <div
                        key={idx}
                        className="stop-item intermediate"
                      >
                        <div className="stop-marker"></div>
                        <div className="stop-details">
                          <strong>Parada {idx + 1}:</strong> {stop}
                        </div>
                      </div>
                    ))}
                    <div className="stop-item end">
                      <div className="stop-marker"></div>
                      <div className="stop-details">
                        <strong>Destino:</strong>{" "}
                        {seleccionada.destinationLabel}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Selectores */}
                <div className="boarding-section">
                  <h4>Selecciona tu viaje</h4>
                  <div className="selectors-grid">
                    <div className="selector-group">
                      <label>Punto de subida</label>
                      <select
                        value={suboEn}
                        onChange={(e) => {
                          const newSubo = Number(e.target.value);
                          setSuboEn(newSubo);
                          if (bajoEn <= newSubo) setBajoEn(newSubo + 1);
                        }}
                        className="route-select"
                      >
                        {seleccionada.points?.map((_, i) => {
                          if (i === seleccionada.points.length - 1)
                            return null;
                          return (
                            <option key={`subo-${i}`} value={i}>
                              {puntoLabel(seleccionada, i)}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="selector-group">
                      <label>Punto de bajada</label>
                      <select
                        value={bajoEn}
                        onChange={(e) => {
                          const newBajo = Number(e.target.value);
                          if (newBajo > suboEn) setBajoEn(newBajo);
                        }}
                        className="route-select"
                      >
                        {seleccionada.points?.map((_, i) => {
                          if (i === 0) return null;
                          return (
                            <option
                              key={`bajo-${i}`}
                              value={i}
                              disabled={i <= suboEn}
                            >
                              {puntoLabel(seleccionada, i)}
                              {i <= suboEn ? " (No válido)" : ""}
                            </option>
                          );
                        })}
                      </select>
                    </div>

                    <div className="selector-group">
                      <label>Asientos a reservar</label>
                      <input
                        type="number"
                        min={1}
                        max={maxSeats || 1}
                        value={seatsWanted}
                        onChange={(e) => {
                          const v = Number(e.target.value || 1);
                          if (v < 1) setSeatsWanted(1);
                          else if (v > (maxSeats || 1))
                            setSeatsWanted(maxSeats || 1);
                          else setSeatsWanted(v);
                        }}
                        className="route-select"
                      />
                      <small className="hint">
                        Disponibles: {maxSeats}
                      </small>
                    </div>
                  </div>

                  <div className="price-calculation">
                    <div className="price-breakdown">
                      <span>Precio por pasajero:</span>
                      <span className="final-price">
                        ${priceSeleccion.toFixed(2)}
                      </span>
                    </div>
                    <div
                      className="price-breakdown"
                      style={{ marginTop: 8 }}
                    >
                      <span>
                        Total ({seatsWanted}{" "}
                        {seatsWanted === 1 ? "asiento" : "asientos"}):
                      </span>
                      <span className="final-price">
                        ${totalPagar.toFixed(2)}
                      </span>
                    </div>
                    <div className="price-note">
                      {suboEn === 0 &&
                      bajoEn === seleccionada.points?.length - 1
                        ? "Viaje completo"
                        : `Tramo: ${puntoLabel(
                            seleccionada,
                            suboEn
                          )} → ${puntoLabel(seleccionada, bajoEn)}`}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn-secondary" onClick={closeModal}>
                Cancelar
              </button>
              <button
                className="btn-primary"
                onClick={confirmReserva}
                disabled={
                  reservando ||
                  bajoEn <= suboEn ||
                  !seleccionada.availableSeats ||
                  seatsWanted < 1 ||
                  seatsWanted > maxSeats
                }
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                {reservando ? (
                  <>
                    <div className="loading-spinner-small"></div>
                    Reservando...
                  </>
                ) : !seleccionada.availableSeats ? (
                  "Sin asientos disponibles"
                ) : (
                  "Confirmar Reserva"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal SOLO de éxito */}
      {successOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <div className="modal-card-ok">
            <h3>✅ Reserva creada</h3>
            <pre>{successMsg}</pre>
            <div className="modal-actions">
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSuccessOpen(false);
                  const { user } = getStored();
                  const uid =
                    user?.id || user?.userId || user?.uid || user?.sub || "";
                  if (uid)
                    navigate(`/pasajero/${uid}`, { replace: true });
                  else navigate("/", { replace: true });
                }}
              >
                Ir al inicio
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast.show && (
        <div
          className={`toast ${
            toast.type === "success"
              ? "toast-success"
              : toast.type === "error"
              ? "toast-error"
              : "toast-info"
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}