import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Polyline, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import marker2x from "leaflet/dist/images/marker-icon-2x.png";
import marker from "leaflet/dist/images/marker-icon.png";
import shadow from "leaflet/dist/images/marker-shadow.png";

/* ====== Leaflet fallback ====== */
L.Icon.Default.mergeOptions({ iconRetinaUrl: marker2x, iconUrl: marker, shadowUrl: shadow });

/* ====== Helpers ====== */
const toLatLng = (maybe) => {
  if (!maybe) return null;
  if (Array.isArray(maybe.coordinates)) {
    const [lng, lat] = maybe.coordinates;
    return [lat, lng];
  }
  if (typeof maybe.lat === "number" && typeof maybe.lng === "number") return [maybe.lat, maybe.lng];
  if (Array.isArray(maybe) && maybe.length === 2) return [maybe[0], maybe[1]];
  return null;
};

const buildPoints = (route) => {
  const o = toLatLng(route.origin);
  const s = Array.isArray(route.stops) ? route.stops.map(toLatLng).filter(Boolean) : [];
  const d = toLatLng(route.destination);
  return [o, ...s, d].filter(Boolean);
};

const sumPrices = (route) => {
  if (typeof route.totalPrice === "number") return route.totalPrice;
  if (Array.isArray(route.prices)) return route.prices.reduce((acc, p) => acc + (Number(p) || 0), 0);
  if (typeof route.price === "number") return route.price;
  return 0;
};

const fmtMoney = (n) =>
  Number.isFinite(n) ? n.toLocaleString("es-MX", { style: "currency", currency: "MXN" }) : "—";

const fmtDateTime = (iso) => {
  if (!iso) return "Sin horario";
  try {
    const d = new Date(iso);
    return d.toLocaleString("es-MX", {
      timeZone: "America/Mexico_City",
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "Sin horario";
  }
};

const statusLabel = (s) =>
  ({ available: "Disponible", active: "Activa", inactive: "Inactiva", closed: "Cerrada" }[s] ||
    s ||
    "—");

/* ====== Marcadores bonitos ====== */
const palette = ["#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd", "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf"];

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

/* ====== Reverse geocoding con cache (lista + modal) ====== */
const NOMI = "https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=16&addressdetails=1";
const coordKey = (lat, lng) => `${(+lat).toFixed(5)},${(+lng).toFixed(5)}`;

const pickNiceAddress = (addr = {}, display = "") => {
  const l1 =
    addr.road ||
    addr.pedestrian ||
    addr.residential ||
    addr.cycleway ||
    addr.path ||
    addr.neighbourhood ||
    addr.suburb ||
    addr.village ||
    addr.town ||
    addr.city;
  const area =
    addr.suburb ||
    addr.neighbourhood ||
    addr.village ||
    addr.town ||
    addr.city ||
    addr.municipality ||
    addr.state_district ||
    addr.state;
  if (l1 && area) return `${l1}, ${area}`;
  if (display) {
    const parts = display.split(",").map((s) => s.trim());
    return parts.slice(0, 2).join(", ");
  }
  return l1 || area || "";
};

async function reverseOnce(lat, lng) {
  const url = `${NOMI}&lat=${lat}&lon=${lng}`;
  const r = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es",
      "User-Agent": "colibri-web/1.0 (contacto@colibri.app)",
    },
  });
  if (!r.ok) throw new Error("geo");
  const j = await r.json();
  return pickNiceAddress(j.address, j.display_name) || j.display_name || "";
}

/** Hook: resuelve en lote todos los nombres (origen, paradas, destino) de todas las rutas */
function useReverseNames(routes) {
  const [names, setNames] = useState({});
  const pending = useRef(new Set());

  const pairs = useMemo(() => {
    const arr = [];
    for (const r of routes || []) {
      const pts = buildPoints(r);
      pts.forEach(([lat, lng]) => {
        if (Number.isFinite(lat) && Number.isFinite(lng)) arr.push({ lat, lng });
      });
    }
    return arr;
  }, [routes]);

  useEffect(() => {
    const raw = localStorage.getItem("geo:reverseCache") || "{}";
    const cache = JSON.parse(raw);
    setNames((prev) => ({ ...cache, ...prev }));

    const toFetch = [];
    for (const p of pairs) {
      const k = coordKey(p.lat, p.lng);
      if (!cache[k] && !pending.current.has(k)) toFetch.push({ ...p, k });
    }
    if (!toFetch.length) return;

    let cancel = false;
    (async () => {
      for (const p of toFetch) {
        if (cancel) break;
        try {
          pending.current.add(p.k);
          const label = await reverseOnce(p.lat, p.lng);
          setNames((prev) => {
            const next = { ...prev, [p.k]: label };
            localStorage.setItem("geo:reverseCache", JSON.stringify(next));
            return next;
          });
          await new Promise((r) => setTimeout(r, 160)); // rate limit friendly
        } catch {
          setNames((prev) => {
            if (prev[p.k]) return prev;
            const next = { ...prev, [p.k]: "" };
            localStorage.setItem("geo:reverseCache", JSON.stringify(next));
            return next;
          });
        } finally {
          pending.current.delete(p.k);
        }
      }
    })();

    return () => {
      cancel = true;
    };
  }, [JSON.stringify(pairs)]); // pares cambian -> refetch faltantes

  const getName = (lat, lng) => names[coordKey(lat, lng)] || "";
  return { getName };
}

/* ============================ MODAL DETALLES ============================ */
function RouteDetailsModal({ open, route, onClose, getName }) {
  const mapRef = useRef(null);
  const color = useMemo(() => {
    const key = (route?.id || route?._id || "0") + "";
    const idx = Math.abs(
      Array.from(key).reduce((h, ch) => ((h << 5) - h + ch.charCodeAt(0)) | 0, 0)
    ) % palette.length;
    return palette[idx];
  }, [route]);

  const points = useMemo(() => (route ? buildPoints(route) : []), [route]);

  const originName = useMemo(() => {
    if (!points[0]) return "Inicio";
    const [lat, lng] = points[0];
    return getName(lat, lng) || "Cargando...";
  }, [points, getName]);

  const destName = useMemo(() => {
    if (points.length < 2) return "Destino";
    const [lat, lng] = points[points.length - 1];
    return getName(lat, lng) || "Cargando...";
  }, [points, getName]);

  const stopNames = useMemo(() => {
    if (points.length <= 2) return [];
    return points.slice(1, -1).map(([lat, lng], i) => getName(lat, lng) || `Cargando...`);
  }, [points, getName]);

  useEffect(() => {
    if (!open || !mapRef.current || points.length === 0) return;
    const map = mapRef.current;
    setTimeout(() => {
      try {
        map.invalidateSize();
        if (points.length === 1) map.setView(points[0], 14);
        else {
          const bounds = L.latLngBounds(points);
          map.fitBounds(bounds, { padding: [24, 24] });
        }
      } catch {}
    }, 120);
  }, [open, points]);

  if (!open || !route) return null;

  const total = sumPrices(route);
  const seats = route.availableSeats ?? route.seats ?? route.capacity ?? null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card modal-compact" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Detalle de la ruta</h3>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">×</button>
        </div>

        <div className="modal-body scrollable">
          {/* Mapa */}
          <div className="modal-map">
            <MapContainer
              className="leaflet-mini"
              center={points[0] || [20.5888, -100.3899]}
              zoom={13}
              scrollWheelZoom={false}
              whenCreated={(m) => (mapRef.current = m)}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {points.length >= 2 && (
                <Polyline positions={points} pathOptions={{ color, weight: 5, opacity: 0.9 }} />
              )}
              {points.map((pt, i) => {
                const isStart = i === 0;
                const isEnd = i === points.length - 1;
                const icon = isStart ? pinIcon(color, "S") : isEnd ? pinIcon(color, "D") : stopIcon(color);
                const label =
                  isStart ? originName : isEnd ? destName : (stopNames[i - 1] || `Parada ${i}`);
                return (
                  <Marker key={`pt-${i}`} position={pt} icon={icon}>
                    <Popup>
                      <div className="popup">
                        <div className="popup-title">{label}</div>
                        <div className="popup-body">
                          <div><b>Horario:</b> {fmtDateTime(route.schedule || route.date)}</div>
                          <div><b>Asientos:</b> {seats ?? "—"}</div>
                          <div><b>Estatus:</b> {statusLabel(route.status)}</div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                );
              })}
            </MapContainer>
          </div>

          {/* Info */}
          <div className="modal-info">
            <div className="info-row"><span className="label">Fecha/hora:</span><span className="value">{fmtDateTime(route.schedule || route.date)}</span></div>
            <div className="info-row"><span className="label">Inicio:</span><span className="value" style={{ fontWeight: 800 }}>{originName}</span></div>
            <div className="info-row">
              <span className="label">Paradas:</span>
              <span className="value">{stopNames.length ? stopNames.join(" • ") : "—"}</span>
            </div>
            <div className="info-row"><span className="label">Destino:</span><span className="value" style={{ fontWeight: 800 }}>{destName}</span></div>

            <div className="separator" />

            <div className="info-row"><span className="label">Asientos:</span><span className="value">{seats ?? "—"}</span></div>
            <div className="info-row"><span className="label">Estatus:</span><span className="value">{statusLabel(route.status)}</span></div>
            <div className="info-row"><span className="label">Total:</span><span className="value" style={{ fontWeight: 900 }}>{fmtMoney(total)}</span></div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-sec" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

/* ============================ LISTA + MODAL ============================ */
export default function RoutesListConductor({
  routesLoading,
  routesError,
  myRoutes,
  onShowForm,
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);

  // Hook que obtiene los nombres de las coordenadas
  const { getName } = useReverseNames(myRoutes);

  const openDetails = (route) => {
    setSelected(route);
    setOpen(true);
  };
  const closeDetails = () => {
    setOpen(false);
    setSelected(null);
  };

  const statusClass = (s) => (s === "available" || s === "activa" ? "activa" : "inactiva");

  return (
    <>
      <div className="rutas-container rutas-grid">
        {routesLoading && <div className="ruta-card">Cargando rutas…</div>}
        {!routesLoading && routesError && (
          <div className="ruta-card error">Error al cargar rutas: {routesError}</div>
        )}
        {!routesLoading && !routesError && myRoutes.length === 0 && (
          <div className="ruta-card ruta-empty">
            <p className="mb-2">Aún no se cuentan con rutas.</p>
            <button className="btn-primary" onClick={onShowForm}>+ Crear ruta</button>
          </div>
        )}

        {!routesLoading &&
          !routesError &&
          myRoutes.length > 0 &&
          myRoutes.map((r, index) => {
            const pts = buildPoints(r);

            // Origen
            const originName =
              pts[0]
                ? getName(pts[0][0], pts[0][1]) || "Cargando..."
                : "Inicio";

            // Destino
            const destName =
              pts.length >= 2
                ? getName(pts[pts.length - 1][0], pts[pts.length - 1][1]) || "Cargando..."
                : "Destino";

            // Paradas
            const stopNames =
              pts.length > 2
                ? pts.slice(1, -1).map(([lat, lng], i) =>
                    getName(lat, lng) || `Cargando...`
                  )
                : [];

            const total = sumPrices(r);
            const seats = r.availableSeats ?? r.seats ?? null;
            const dateStr = fmtDateTime(r.schedule || r.date);

            return (
              <div key={r.id || r._id || `route-${index}`} className="ruta-card">
                <div className="ruta-header">
                  <div>
                    <h4 className="ruta-titulo">{originName} → {destName}</h4>
                    <p className="ruta-horario">{dateStr}</p>
                    {stopNames.length > 0 && (
                      <p className="ruta-paradas">
                        Paradas: {stopNames.join(" • ")}
                      </p>
                    )}
                  </div>
                  <span className={`status-badge ${statusClass(r.status)}`}>
                    {statusLabel(r.status)}
                  </span>
                </div>

                <div className="ruta-body">
                  <div className="ruta-info">
                    <span className="info-badge">{fmtMoney(total)}</span>
                    {seats ? (
                      <span className="info-badge">{seats} asientos</span>
                    ) : (
                      <span className="info-badge">Sin asientos</span>
                    )}
                  </div>

                  <div className="ruta-actions mt-3">
                    <button className="btn-primary w-100" onClick={() => openDetails(r)}>
                      Ver detalles
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
      <RouteDetailsModal open={open} route={selected} onClose={closeDetails} getName={getName} />
    </>
  );
}