// src/pages/HomeConductor.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "../styles/homeConductor.css";
import DashboardLayout from "../layouts/DashboardLayout";
import PerfilConductor from "../components/conductor/PerfilConductor";
import NotificacionesConductor from "../components/conductor/NotificacionesConductor";
import HistorialConductor from "../components/conductor/HistorialConductor";
import RoutesListConductor from "../components/conductor/RoutesListConductor";
import RouteFormConductor from "../components/conductor/RouteFormConductor";
import { useLocation } from "react-router-dom";

// Leaflet
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

// ==========================
// Icono por defecto Leaflet
// ==========================
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});
const defaultIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

// Centro por defecto para el mapa principal (fallback)
const ARROYO_SECO_CENTER = [20.5888, -100.3899];

// Íconos personalizados por tipo (acorde a la estética de la app)
const originIcon = L.divIcon({
  className: "marker-dot marker-origin",
  html: '<span class="marker-pin"></span><span class="marker-abbr">O</span>',
  iconSize: [28, 36],
  iconAnchor: [14, 18],
  popupAnchor: [0, -18],
});

const destIcon = L.divIcon({
  className: "marker-dot marker-dest",
  html: '<span class="marker-pin"></span><span class="marker-abbr">D</span>',
  iconSize: [28, 36],
  iconAnchor: [14, 18],
  popupAnchor: [0, -18],
});

const stopIcon = L.divIcon({
  className: "marker-dot marker-stop",
  html: '<span class="marker-pin"></span><span class="marker-abbr">P</span>',
  iconSize: [28, 36],
  iconAnchor: [14, 18],
});

// Helper para usar el ícono según el modo del marcador
const getMarkerIcon = (mode) => (mode === "origin" ? originIcon : mode === "dest" ? destIcon : stopIcon);

// ======== Helpers de identidad ========
function extractDriverIdFromUser(u) {
  if (!u || typeof u !== "object") return "";
  // IDs comunes directos
  const direct = u.id || u._id || u.userId || u.uuid || u.driverId || u.driverUUID || "";
  if (direct) return String(direct);
  // IDs anidados frecuentes
  const nested =
    u.driver?.id ||
    u.driver?._id ||
    u.driver?.userId ||
    u.driver?.uuid ||
    u.profile?.id ||
    u.profile?._id ||
    "";
  return nested ? String(nested) : "";
}

/* ===========================
   Barra de búsqueda (reusable)
   =========================== */
function SearchPlacesBar({ phase, onPick }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [highlight, setHighlight] = useState(-1);
  const [recent, setRecent] = useState([]);
  const ref = useRef(null);
  const timeoutRef = useRef(null);

  const placeholder =
    phase === "origin" ? "Buscar lugar de partida…" : phase === "dest" ? "Buscar destino…" : "Buscar parada…";

  useEffect(() => {
    try {
      const raw = localStorage.getItem("route_search_recent");
      if (raw) setRecent(JSON.parse(raw));
    } catch {}
  }, []);

  const saveRecent = (item) => {
    try {
      const next = [item, ...recent.filter((r) => r.display_name !== item.display_name)].slice(0, 8);
      setRecent(next);
      localStorage.setItem("route_search_recent", JSON.stringify(next));
    } catch {}
  };

  // Cerrar al click fuera
  useEffect(() => {
    const onDocClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
};
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  // Debounce search
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!query || query.trim().length < 3) {
      setResults([]);
      setLoading(false);
      return;
    }

    timeoutRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const resp = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=7&countrycodes=mx&addressdetails=1`,
          {
            headers: {
              "User-Agent": "colibri-web/1.0 (contacto@colibri.app)",
              Referer: window.location.origin,
            },
          }
        );
        const data = await resp.json();
        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setOpen(true);
        setHighlight(-1);
      }
    }, 350);

    return () => clearTimeout(timeoutRef.current);
  }, [query]);

  const parseTitle = (display) => {
    if (!display) return { title: "", subtitle: "" };
    const parts = display.split(",").map((s) => s.trim());
    const title = parts[0] || display;
    const subtitle = parts.slice(1, 3).join(", ");
    return { title, subtitle };
  };

  const handleChoose = (item) => {
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    const label = item.display_name || "";
    onPick({ lat, lng, label });
    saveRecent(item);
    setQuery("");
    setOpen(false);
    setResults([]);
    setHighlight(-1);
  };

  const handleKeyDown = (e) => {
    if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setOpen(true);
      return;
    }
    const list = results.length ? results : recent;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min((list.length || 0) - 1, h + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(-1, h - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && list.length && highlight >= 0) {
        handleChoose(list[highlight]);
      } else if (open && list.length) {
        handleChoose(list[0]);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="search-container card p-3 mb-2" ref={ref}>
      <div className="search-input-wrapper">
        <span className="search-icon">🔎</span>
        <input
          type="text"
          className="form-control search-input"
          placeholder={placeholder}
value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
        />
        {loading && <span className="search-spinner" aria-label="cargando" />}
        {query && !loading && (
          <button
            type="button"
            className="clear-btn"
            onClick={() => {
              setQuery("");
              setResults([]);
              setHighlight(-1);
              setOpen(true);
            }}
            aria-label="Limpiar"
          >
            ×
          </button>
        )}
        <span className="phase-chip">{phase === "origin" ? "Partida" : phase === "dest" ? "Destino" : "Parada"}</span>
      </div>

      {open && (results.length > 0 || (!query && recent.length > 0)) && (
        <div className="results-dropdown">
          {(results.length ? results : recent).map((r, idx) => {
            const { title, subtitle } = parseTitle(r.display_name);
            return (
              <button
                key={`${r.place_id || r.display_name}-${idx}`}
                type="button"
                className={`result-item ${idx === highlight ? "active" : ""}`}
                onMouseEnter={() => setHighlight(idx)}
                onClick={() => handleChoose(r)}
              >
                <div className="result-main">{title}</div>
                {subtitle && <div className="result-sub">{subtitle}</div>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ===========================
   Modal para escoger en mapa
   =========================== */
function MapPickModal({
  open,
  title,
  phase,              // "origin" | "dest" | "stop"
  initialPoint,       // {lat,lng,label} | null
  center = ARROYO_SECO_CENTER,
  onClose,
  onConfirm,
  reverseGeocode,
}) {
  const [preview, setPreview] = useState(initialPoint || null);
  const mapRef = useRef(null);

  // Bloquear scroll de fondo y ajustar Leaflet al abrir
  useEffect(() => {
    if (open) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const t = setTimeout(() => {
        if (mapRef.current) {
          mapRef.current.invalidateSize(false);
          if (preview?.lat && preview?.lng) {
            mapRef.current.setView([preview.lat, preview.lng], 14);
          }
        }
      }, 180);
      return () => {
        document.body.style.overflow = prev;
        clearTimeout(t);
      };
    }
  }, [open, preview?.lat, preview?.lng]);

  // Click en mapa
  const LocationPicker = () => {
    useMapEvents({
      async click(e) {
        const { lat, lng } = e.latlng;
        const label = await reverseGeocode(lat, lng);
        setPreview({ lat, lng, label });
      },
    });
    return null;
  };

  if (!open) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-card modal-mobile-full">
        <div className="modal-header">
          <h4>{title}</h4>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body-scroll">
          {/* Buscador dentro del modal */}
          <SearchPlacesBar
            phase={phase}
            onPick={({ lat, lng, label }) => {
              setPreview({ lat, lng, label });
              if (mapRef.current) mapRef.current.setView([lat, lng], 14);
            }}
          />

          <div className="modal-map-wrapper">
            <MapContainer
              center={preview ? [preview.lat, preview.lng] : center}
              zoom={13}
              style={{ height: 420, width: "100%" }}
              whenCreated={(m) => (mapRef.current = m)}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <LocationPicker />
              {preview && (
                <Marker
                  position={[preview.lat, preview.lng]}
                  icon={phase === "origin" ? originIcon : phase === "dest" ? destIcon : stopIcon}
                >
                  <Popup>
                    {(phase === "origin" ? "O" : phase === "dest" ? "D" : "P") + " – "}
                    {preview.label || "Dirección no disponible"}
                  </Popup>
                </Marker>
              )}
            </MapContainer>
          </div>

          <div className="modal-selected mt-2">
            {preview ? (
              <>
                <div className="pill ok">✓ Seleccionado</div>
                <div className="sel-label">{preview.label}</div>
              </>
            ) : (
              <div className="pill warn">Toca el mapa o usa el buscador para seleccionar.</div>
            )}
          </div>
        </div>

        <div className="modal-actions fixed-bottom-actions">
          {initialPoint && (
            <button
              type="button"
              className="btn btn-outline-danger"
              onClick={() => {
                setPreview(null);
                onConfirm(null); // quitar selección
                onClose();
              }}
              title="Quitar selección"
            >
              Quitar
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={!preview}
            onClick={() => {
              onConfirm(preview);
              onClose();
            }}
          >
            Confirmar
          </button>
        </div>
      </div>
    </div>
  );
}

/* ===========================
   Vista principal
   =========================== */
export default function HomeConductor() {
  const location = useLocation();

  // Estado para la sección activa
  const [activeSection, setActiveSection] = useState("rutas");

  // Sincroniza la sección activa con el parámetro de navegación
  useEffect(() => {
    // Prioridad: estado de navegación > query string > default
    const sectionFromState = location.state?.section;
    if (sectionFromState) {
      setActiveSection(sectionFromState);
      return;
    }
    const sp = new URLSearchParams(location.search);
    const sectionFromQuery = sp.get("s");
    if (sectionFromQuery) {
      setActiveSection(sectionFromQuery);
      return;
    }
    setActiveSection("rutas");
  }, [location.state?.section, location.search]);

  const [currentView, setCurrentView] = useState("home");
  const [phase, setPhase] = useState("origin");
  const [currentPosition, setCurrentPosition] = useState(ARROYO_SECO_CENTER);
  const [markers, setMarkers] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");
  const [showAlert, setShowAlert] = useState(false);
  const [alertType, setAlertType] = useState("info");

  const showToastMsg = (msg, type = "info") => {
    setAlertMessage(msg);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3500);
  };

  const scheduleRef = useRef(null);
  const bigMapRef = useRef(null);

  useEffect(() => {
    const map = bigMapRef.current;
    if (!map) return;

    const points = markers.map((m) => [m.lat, m.lng]);
    if (points.length === 0) {
      map.setView(ARROYO_SECO_CENTER, 11);
    } else if (points.length === 1) {
      map.setView(points[0], 13);
    } else {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }, [markers]);

  // ======== Auth & User ========
  const [driverId, setDriverId] = useState("");
  const [token, setToken] = useState("");

  useEffect(() => {
    const possibleTokenKeys = ["colibri:token", "colibri:access_token", "token"];
    const possibleUserKeys = ["colibri:user", "user", "colibri:profile"];

    // Token
    let t = "";
    for (const k of possibleTokenKeys) {
      const val = localStorage.getItem(k);
      if (val) {
        t = val.replace(/"/g, "");
        break;
      }
    }
    setToken(t || "");

    // Usuario -> driverId
    let uid = "";
    for (const k of possibleUserKeys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        uid = extractDriverIdFromUser(parsed);
        if (uid) break;
      } catch {
        // si viene mal formateado, lo ignoramos
      }
    }
    // fallback por navegación
    if (!uid && location?.state?.userId) uid = String(location.state.userId);

    setDriverId(uid || "");
    if (uid) {
      setFormData((p) => ({ ...p, driverId: uid }));
    }
  }, [location]);

  // ======== Rutas del conductor ========
  const [routesLoading, setRoutesLoading] = useState(false);
  const [routesError, setRoutesError] = useState("");
  const [myRoutes, setMyRoutes] = useState([]);

  // Función para obtener los nombres faltantes usando reverseGeocode
  const enrichRoutesWithNames = async (routes) => {
    const enriched = await Promise.all(
      routes.map(async (r) => {
        let originName = r.labels.origin;
        let destName = r.labels.destination;
        let stopNames = r.labels.stops;

        // Si no hay nombre, lo buscamos por coordenadas
        if (!originName && r.origin && r.origin.coordinates) {
          originName = await reverseGeocode(r.origin.coordinates[1], r.origin.coordinates[0]);
        }
        if (!destName && r.destination && r.destination.coordinates) {
          destName = await reverseGeocode(r.destination.coordinates[1], r.destination.coordinates[0]);
        }
        // Paradas
        if (Array.isArray(r.stops) && r.stops.length > 0) {
          stopNames = await Promise.all(
            r.stops.map(async (s, idx) => {
              if (r.labels.stops && r.labels.stops[idx]) return r.labels.stops[idx];
              if (s && s.coordinates) {
                return await reverseGeocode(s.coordinates[1], s.coordinates[0]);
              }
              return "";
            })
          );
        }

        return {
          ...r,
          labels: {
            origin: originName,
            destination: destName,
            stops: stopNames,
          },
        };
      })
    );
    setMyRoutes(enriched);
  };

  const fetchDriverRoutes = async (uid, tk) => {
    if (!uid || !tk) return;
    setRoutesLoading(true);
    setRoutesError("");
    try {
      const url = `https://c-apigateway.onrender.com/api/routes/driver/${encodeURIComponent(uid)}`;
      const resp = await fetch(url, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tk}`,
        },
      });

      if (resp.status === 404) {
        setMyRoutes([]);
        setRoutesError("");
        return;
      }

      const ct = resp.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        const text = await resp.text();
        if (resp.status === 200 && text.startsWith("<!DOCTYPE")) {
          setMyRoutes([]);
          setRoutesError("");
          return;
        }
        throw new Error(`Respuesta no-JSON (status ${resp.status}). Frag: ${text.slice(0, 80)}…`);
      }

      if (resp.ok) {
        const data = await resp.json();
        const list = Array.isArray(data) ? data : data?.items || [];

        // Normalización original
        const normalized = list.map((r) => {
          const originLabel =
            r.labels?.origin ||
            r.origin?.label ||
            r.originLabel ||
            r.from?.label ||
            (r.origin && (r.origin.address || r.origin.name)) ||
            "";

          const destinationLabel =
            r.labels?.destination ||
            r.destination?.label ||
            r.destinationLabel ||
            r.to?.label ||
            (r.destination && (r.destination.address || r.destination.name)) ||
            "";

          const stops =
            (Array.isArray(r.labels?.stops) && r.labels.stops) ||
            (Array.isArray(r.stops) && r.stops.map((s) => s.label || s.address || "")) ||
            [];

          const totalPrice =
            r.totalPrice ??
            (Array.isArray(r.prices)
              ? r.prices.reduce((sum, p) => sum + (Number.isFinite(+p) ? +p : 0), 0)
              : undefined) ??
            (Number.isFinite(+r.price) ? +r.price : undefined);

          const vehicleType = r.vehicleType || r.vehicle?.type || r.type || "car";
          const availableSeats = r.availableSeats ?? r.seats ?? r.capacity ?? "";
          const schedule = r.schedule || r.date || r.datetime || "";
          const status = r.status || r.state || "available";

          return {
            ...r,
            id: r.id || r._id,
            schedule,
            totalPrice,
            vehicleType,
            labels: {
              origin: originLabel,
              destination: destinationLabel,
              stops,
            },
            status,
            availableSeats,
          };
        });

        // Enriquecer con nombres si faltan
        await enrichRoutesWithNames(normalized);
      } else {
        const er = await resp.json().catch(() => ({}));
        throw new Error(er.message || `HTTP ${resp.status}`);
      }
    } catch (err) {
      setRoutesError(err.message || "Error al cargar rutas");
      setMyRoutes([]);
    } finally {
      setRoutesLoading(false);
    }
  };

  useEffect(() => {
    if (driverId && token) fetchDriverRoutes(driverId, token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [driverId, token]);

  // Geolocalización inicial
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setCurrentPosition([pos.coords.latitude, pos.coords.longitude]),
        () => {}
      );
    }
  }, []);

  // ===== Reverse Geocoding =====
  const reverseGeocode = async (lat, lng) => {
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=es`,
        { headers: { "User-Agent": "colibri-web/1.0 (contacto@colibri.app)", Referer: window.location.origin } }
      );
    const data = await r.json();
      return data.display_name || "";
    } catch {
      return "";
    }
  };

  // Form data
  const [formData, setFormData] = useState({
    driverId: "",
    originLng: "",
    originLat: "",
    originLabel: "",
    stops: [],
    destLng: "",
    destLat: "",
    destLabel: "",
    schedule: "",
    isOneTime: true,
    isRecurrent: false,
    frequency: "",
    prices: [],
    availableSeats: "",
    status: "available",
  });

  useEffect(() => {
    if (driverId) setFormData((p) => ({ ...p, driverId }));
  }, [driverId]);

  // ===========================
  // MODALES de selección
  // ===========================
  const [modalOpen, setModalOpen] = useState(false);
  const [modalPhase, setModalPhase] = useState("origin"); // qué estamos eligiendo en el modal

  const openModalFor = (p) => {
    setModalPhase(p);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);

  const initialPointForPhase = useMemo(() => {
    if (modalPhase === "origin" && formData.originLat && formData.originLng) {
      return { lat: formData.originLat, lng: formData.originLng, label: formData.originLabel };
    }
    if (modalPhase === "dest" && formData.destLat && formData.destLng) {
      return { lat: formData.destLat, lng: formData.destLng, label: formData.destLabel };
    }
    return null; // paradas no tienen "inicial"
  }, [modalPhase, formData]);

  const onConfirmModal = async (pointOrNull) => {
    // Si el usuario dio "Quitar" (null)
    if (pointOrNull === null) {
      if (modalPhase === "origin") {
        setFormData((p) => ({
          ...p,
          originLng: "",
          originLat: "",
          originLabel: "",
          destLng: "",
          destLat: "",
          destLabel: "",
          stops: [],
          prices: [],
        }));
        setMarkers((prev) => prev.filter((m) => m.mode !== "origin" && m.mode !== "dest" && m.mode !== "stop"));
        setPhase("origin");
        showToastMsg("Origen eliminado");
      } else if (modalPhase === "dest") {
        setFormData((p) => ({
          ...p,
          destLng: "",
          destLat: "",
          destLabel: "",
          stops: [],
          prices: [],
        }));
        setMarkers((prev) => prev.filter((m) => m.mode !== "dest" && m.mode !== "stop"));
        setPhase("dest");
        showToastMsg("Destino eliminado");
      }
      return;
    }

    const { lat, lng, label } = pointOrNull;

    if (modalPhase === "origin") {
      setFormData((p) => ({ ...p, originLng: lng, originLat: lat, originLabel: label }));
      setMarkers((prev) => [...prev.filter((m) => m.mode !== "origin"), { lat, lng, mode: "origin", label }]);
      setPhase("dest");
      showToastMsg("📍 Origen seleccionado");
    } else if (modalPhase === "dest") {
      setFormData((p) => ({ ...p, destLng: lng, destLat: lat, destLabel: label }));
      setMarkers((prev) => [...prev.filter((m) => m.mode !== "dest"), { lat, lng, mode: "dest", label }]);
      setPhase("stops");
      showToastMsg("🏁 Destino seleccionado");
    } else if (modalPhase === "stop") {
      setFormData((prev) => {
        const newStops = [...prev.stops, { lng, lat, label }];
        // Cada tramo necesita un precio: tramos = paradas + 1
        const segments = newStops.length + 1;
        const needPrices = Math.max(segments, prev.prices.length);
        const prices = Array.from({ length: needPrices }, (_, i) => prev.prices[i] ?? "");
        return { ...prev, stops: newStops, prices };
      });
      setMarkers((prev) => [...prev, { lat, lng, mode: "stop", label }]);
      showToastMsg("➕ Parada agregada");
    }
  };

  // Eliminar parada
  const removeStop = (index) => {
    setFormData((prev) => {
      const newStops = prev.stops.filter((_, i) => i !== index);
      const segments = Math.max(0, newStops.length + 1);
      const newPrices = prev.prices.slice(0, segments);
      // quitar el marcador visual correspondiente
      let s = -1;
      const newMarkers = markers.filter((m) => {
        if (m.mode !== "stop") return true;
        s++;
        return s !== index;
      });
      setMarkers(newMarkers);
      return { ...prev, stops: newStops, prices: newPrices };
    });
    showToastMsg("🗑️ Parada eliminada");
  };

  // Actualiza precio por parada (mismo índice)
  const updatePrice = (index, value) => {
    setFormData((prev) => {
      const prices = [...prev.prices];
      prices[index] = value === "" ? "" : Number.isFinite(+value) ? +value : "";
      return { ...prev, prices };
    });
  };

  const totalSuggested = useMemo(
    () => (formData.prices || []).reduce((sum, p) => sum + (Number(p) || 0), 0),
    [formData.prices]
  );

  // Detalles
  const handleFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    if (name === "isOneTime" || name === "isRecurrent") {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
        ...(name === "isOneTime" ? { isRecurrent: false } : { isOneTime: false }),
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: type === "number" ? parseFloat(value) : value }));
    }
  };

  // Crear ruta (API Gateway) — con driverId explícito
  const handleCreateRoute = async (e) => {
    e.preventDefault();

    // Asegurar driverId directamente desde estado o localStorage
    const userRaw =
      localStorage.getItem("colibri:user") ||
      localStorage.getItem("user") ||
      localStorage.getItem("colibri:profile") ||
      "";
    let driverIdFromStore = "";
    try {
      driverIdFromStore = userRaw ? extractDriverIdFromUser(JSON.parse(userRaw)) : "";
    } catch {
      driverIdFromStore = "";
    }
    const driverIdToSend = formData.driverId || driverId || driverIdFromStore || "";

    if (!driverIdToSend) {
      showToastMsg("⚠️ No se detectó el ID del conductor. Inicia sesión nuevamente.", "warning");
      return;
    }
    if (!formData.originLat || !formData.originLng) {
      showToastMsg("⚠️ Agrega primero el lugar de partida.");
      return;
    }
    if (!formData.destLat || !formData.destLng) {
      showToastMsg("⚠️ Agrega el destino para continuar.");
      return;
    }

    // Número de tramos = paradas + 1
    const segments = (formData.stops?.length || 0) + 1;
    let prices = [...(formData.prices || [])].map((p) => (p === "" ? 0 : parseFloat(p) || 0));

    // Validar que tengamos precios para TODOS los tramos
    if (prices.length !== segments) {
      showToastMsg(`⚠️ Debes capturar ${segments} precios (uno por cada tramo).`);
      return;
    }

    const pricesToSend = prices;

    const body = {
      driverId: driverIdToSend, // 👈👈 explícito
      origin: { type: "Point", coordinates: [parseFloat(formData.originLng), parseFloat(formData.originLat)] },
      stops: formData.stops.map((s) => ({ type: "Point", coordinates: [parseFloat(s.lng), parseFloat(s.lat)] })),
      destination: { type: "Point", coordinates: [parseFloat(formData.destLng), parseFloat(formData.destLat)] },
      schedule: formData.schedule,
      isOneTime: formData.isOneTime,
      isRecurrent: formData.isRecurrent,
      frequency: formData.frequency,
      prices: pricesToSend, // todos los precios del paso 3
      availableSeats: formData.availableSeats === "" ? undefined : parseInt(formData.availableSeats),
      status: "available",
      labels: {
        origin: formData.originLabel,
        destination: formData.destLabel,
        stops: formData.stops.map((s) => s.label || ""),
      },
    };

    try {
      const response = await fetch("https://c-apigateway.onrender.com/api/routes/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        await response.json();
        showToastMsg("✅ ¡Ruta creada exitosamente!", "success");
        setFormData({
          driverId: driverIdToSend, // mantenerlo para siguientes creaciones
          originLng: "",
          originLat: "",
          originLabel: "",
          stops: [],
          destLng: "",
          destLat: "",
          destLabel: "",
          schedule: "",
          isOneTime: true,
          isRecurrent: false,
          frequency: "",
          prices: [],
          availableSeats: "",
          status: "available",
        });
        setMarkers([]);
        setPhase("origin");
        setShowForm(false);
        fetchDriverRoutes(driverIdToSend, token);
      } else {
        const error = await response.json().catch(() => ({}));
        showToastMsg("❌ Error al crear ruta: " + (error.message || "Desconocido"), "error");
      }
    } catch (err) {
      showToastMsg("❌ Error de conexión: " + err.message, "error");
    }
  };

  // Habilitadores
  const canGoDest = Boolean(formData.originLabel);
  const canGoStops = Boolean(formData.originLabel && formData.destLabel);
  const canDetails = canGoStops;
  const canSubmit = canDetails;

  const openSchedulePicker = () => {
  const el = scheduleRef.current;
  if (!el) return;

  try {
    // Navegadores modernos (Chrome, algunos WebView)
    if (typeof el.showPicker === "function") {
      el.showPicker();
    } else {
      // Fallback si no existe showPicker
      el.focus();
      el.click?.();
    }
  } catch (err) {
    // En varios WebView móviles lanza NotAllowedError o no soporta bien showPicker
    console.warn("No se pudo abrir el picker nativo:", err);
    // Fallback: al menos enfocamos para que aparezca el teclado / picker nativo
    el.focus();
    el.click?.();
  }
};

  return (
    <DashboardLayout>
      {/* Modal de selección */}
      <MapPickModal
        open={modalOpen}
        title={
          modalPhase === "origin"
            ? "Seleccionar lugar de partida"
            : modalPhase === "dest"
            ? "Seleccionar destino"
            : "Agregar parada"
        }
        phase={modalPhase}
        initialPoint={initialPointForPhase}
        center={currentPosition}
        onClose={closeModal}
        onConfirm={onConfirmModal}
        reverseGeocode={reverseGeocode}
      />

      <div className="home-conductor">
        {activeSection === "rutas" && (
          <>
            {currentView === "home" && (
              <div className="conductor-home">
                {/* Encabezado */}
                <div className="rutas-header">
                  <h2>Mis rutas</h2>
                  <p className="rutas-sub">Administra y crea tus rutas fácilmente.</p>
                </div>

                {/* Lista de rutas del conductor */}
                <RoutesListConductor
                  routesLoading={routesLoading}
                  routesError={routesError}
                  myRoutes={myRoutes}
                  onShowForm={() => setShowForm(true)}
                  onViewDetails={() => setCurrentView("ride-details")}
                />

                {/* Formulario crear ruta */}
                {showForm && (
                  <RouteFormConductor
                    formData={formData}
                    markers={markers}
                    totalSuggested={totalSuggested}
                    canGoDest={canGoDest}
                    canGoStops={canGoStops}
                    canDetails={canDetails}
                    canSubmit={canSubmit}
                    handleFormChange={handleFormChange}
                    handleCreateRoute={handleCreateRoute}
                    openModalFor={openModalFor}
                    onConfirmModal={onConfirmModal}
                    removeStop={removeStop}
                    updatePrice={updatePrice}
                    openSchedulePicker={openSchedulePicker}
                    getMarkerIcon={getMarkerIcon}
                    currentPosition={currentPosition}
                    showToastMsg={showToastMsg}
                    scheduleRef={scheduleRef}
                  />
                )}

                {/* Botón flotante crear ruta */}
                <button
                  className="fab-create-route"
                  onClick={() => setShowForm((v) => !v)}
                  title="Crear ruta"
                  aria-label="Crear ruta"
                >
                  {showForm ? "✖" : "＋"}
                </button>
              </div>
            )}

          {activeSection === "rutas" && currentView === "ride-details" && (
  <div className="ruta-card ruta-card--light">
    <h4>Detalles de la ruta</h4>
    <p className="ruta-horario">Selecciona una ruta de la lista para ver más.</p>
    <button className="btn-primary" onClick={() => setCurrentView("home")}>
      Volver a mis rutas
    </button>
  </div>
)}

            {activeSection === "historial" && <HistorialConductor />}
            {activeSection === "notificaciones" && <NotificacionesConductor />}
            {activeSection === "perfil" && <PerfilConductor />}
          </>
        )}

        {activeSection === "historial" && <HistorialConductor />}
        {activeSection === "notificaciones" && <NotificacionesConductor />}
        {activeSection === "perfil" && <PerfilConductor />}
      </div>

      {/* Alert personalizado */}
      {showAlert && (
        <div className={`custom-alert custom-alert-${alertType}`}>
          <div className="alert-content">
            <span className="alert-message">{alertMessage}</span>
            <button
              className="alert-close"
              onClick={() => setShowAlert(false)}
              aria-label="Cerrar alerta"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}