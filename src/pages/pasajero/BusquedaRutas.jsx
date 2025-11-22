// src/pages/pasajero/BusquedaRutas.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "../../styles/pasajero/busquedaRutas.css";

const API = "http://localhost:8080";

function fmtHora(fechaIso) {
  try {
    const d = new Date(fechaIso);
    return d.toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return "—";
  }
}

// Construye la ruta lineal de puntos (origin → stops[] → destination)
function buildPointChain(doc) {
  const pts = [];
  if (doc.origin) pts.push({ ...doc.origin, _label: "Origen" });
  (doc.stops || []).forEach((s, i) => pts.push({ ...s, _label: `Parada ${i + 1}` }));
  if (doc.destination) pts.push({ ...doc.destination, _label: "Destino" });
  return pts;
}

// Calcula precio de un sub-tramo sumando segmentos consecutivos
// prices[i] = costo desde punto i hacia i+1
function calcPartialPrice(doc, fromIdx, toIdx) {
  const prices = Array.isArray(doc.prices) ? doc.prices : [];
  let total = 0;
  for (let i = fromIdx; i < toIdx; i++) {
    total += Number(prices[i] || 0);
  }
  return total;
}

// Heurística simple para “match” por texto contra etiquetas (sin coords crudas)
function matchIndexByText(points, text) {
  if (!text) return -1;
  const t = String(text).toLowerCase();
  // Intentar por etiqueta _label (Origen/Parada/Destino)
  let idx = points.findIndex(p => (p._label || "").toLowerCase().includes(t));
  if (idx >= 0) return idx;
  // Si tu backend agrega nombres legibles, puedes mapear aquí, por ejemplo p.name
  idx = points.findIndex(p => (p.name || "").toLowerCase().includes(t));
  return idx;
}

export default function BusquedaRutas() {
  const location = useLocation();
  const navigate = useNavigate();

  const origenTxt = location.state?.origen || "";
  const destinoTxt = location.state?.destino || "";
  const geo = location.state?.geo || null; // { lat, lng } cuando origen = “Cerca de mí”
  const filtrosIn = location.state?.filtros || { precioMax: 200, asientos: 1 };

  const [precioMax, setPrecioMax] = useState(filtrosIn.precioMax ?? 200);
  const [asientos, setAsientos] = useState(filtrosIn.asientos ?? 1);

  const [rutas, setRutas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  // Busca al cargar (texto o por puntos según venga de Home)
  useEffect(() => {
    const fetchRutas = async () => {
      setCargando(true);
      setError("");
      try {
        let url = "";
        let qs = new URLSearchParams();

        if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") {
          // Búsqueda por puntos (origen cerca del usuario)
          url = `${API}/api/routes/search/by-points`;
          qs.set("originLat", String(geo.lat));
          qs.set("originLng", String(geo.lng));
          // Si el usuario dio un destino textual, lo mandamos como pista
          if (destinoTxt) qs.set("qDestination", destinoTxt);
          // Filtros
          qs.set("priceMax", String(precioMax));
          qs.set("seats", String(asientos));
          // Radio por defecto 5 km (ajústalo a tu backend)
          qs.set("maxDistanceMeters", "5000");
        } else {
          // Búsqueda textual
          url = `${API}/api/routes/search`;
          if (origenTxt) qs.set("qOrigin", origenTxt);
          if (destinoTxt) qs.set("qDestination", destinoTxt);
          qs.set("priceMax", String(precioMax));
          qs.set("seats", String(asientos));
        }

        const resp = await fetch(`${url}?${qs.toString()}`, {
          method: "GET",
          headers: {
            "content-type": "application/json",
          },
        });

        if (!resp.ok) {
          const txt = await resp.text();
          throw new Error(`Error ${resp.status}: ${txt}`);
        }

        const data = await resp.json();
        // Normaliza a array
        const docs = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
        setRutas(docs);
      } catch (e) {
        setError(e.message || "No se pudieron cargar las rutas");
      } finally {
        setCargando(false);
      }
    };

    fetchRutas();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // solo al montar

  // Aplicar filtros sin relanzar la búsqueda al backend (opcional)
  const rutasFiltradas = useMemo(() => {
    return (rutas || []).filter(r => {
      const seatsOk = (r.seatsAvailable ?? r.asientosDisponibles ?? 1) >= asientos;
      const totalPrice = Array.isArray(r.prices) ? r.prices.reduce((a, b) => a + Number(b || 0), 0) : Number(r.price || r.precio || 0);
      const priceOk = totalPrice <= precioMax || precioMax <= 0 ? true : totalPrice <= precioMax;
      return seatsOk && priceOk;
    });
  }, [rutas, asientos, precioMax]);

  const handleRebuscar = async () => {
    // Relanzar búsqueda con los filtros actuales
    setCargando(true);
    setError("");
    try {
      let url = "";
      let qs = new URLSearchParams();

      if (geo && typeof geo.lat === "number" && typeof geo.lng === "number") {
        url = `${API}/api/routes/search/by-points`;
        qs.set("originLat", String(geo.lat));
        qs.set("originLng", String(geo.lng));
        if (destinoTxt) qs.set("qDestination", destinoTxt);
        qs.set("priceMax", String(precioMax));
        qs.set("seats", String(asientos));
        qs.set("maxDistanceMeters", "5000");
      } else {
        url = `${API}/api/routes/search`;
        if (origenTxt) qs.set("qOrigin", origenTxt);
        if (destinoTxt) qs.set("qDestination", destinoTxt);
        qs.set("priceMax", String(precioMax));
        qs.set("seats", String(asientos));
      }

      const resp = await fetch(`${url}?${qs.toString()}`, {
        method: "GET",
        headers: { "content-type": "application/json" },
      });
      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Error ${resp.status}: ${txt}`);
      }
      const data = await resp.json();
      const docs = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
      setRutas(docs);
    } catch (e) {
      setError(e.message || "No se pudieron cargar las rutas");
    } finally {
      setCargando(false);
    }
  };

  const handleReservar = (ruta, precioSegmento) => {
    navigate("/pasajero/reserva", { state: { ruta, precioSegmento } });
  };

  return (
    <div className="busqueda-rutas">
      <div className="busqueda-header">
        <h1>Rutas disponibles</h1>
        <p>
          {origenTxt ? `Desde: ${origenTxt}` : "Origen: —"} · {destinoTxt ? `Hacia: ${destinoTxt}` : "Destino: —"}
        </p>
      </div>

      {/* Filtros mínimos */}
      <div className="filtros-section">
        <div className="filtros-grid">
          <div className="filtro-group">
            <label>Precio Máximo: ${precioMax}</label>
            <input
              type="range"
              min="20"
              max="500"
              value={precioMax}
              onChange={(e) => setPrecioMax(parseInt(e.target.value))}
            />
          </div>

          <div className="filtro-group">
            <label>Asientos: {asientos}</label>
            <input
              type="number"
              min="1"
              max="6"
              value={asientos}
              onChange={(e) => setAsientos(parseInt(e.target.value) || 1)}
            />
          </div>

          <button className="btn-aplicar" onClick={handleRebuscar}>
            Aplicar
          </button>
        </div>
      </div>

      {/* Estado */}
      {error ? <div className="alert alert-danger">{error}</div> : null}
      {cargando ? <div className="cargando">Buscando rutas…</div> : null}

      {/* Resultados */}
      {!cargando && !error && (
        <div className="resultados-section">
          {rutasFiltradas.length === 0 ? (
            <div className="sin-resultados">
              <h3>No se encontraron rutas</h3>
              <p>Intenta ajustar tus filtros o cambiar tu origen/destino.</p>
            </div>
          ) : (
            <div className="rutas-grid">
              {rutasFiltradas.map((r) => {
                const chain = buildPointChain(r);
                // Intentar localizar índices de origen/destino de la búsqueda
                let fromIdx = matchIndexByText(chain, origenTxt);
                if (fromIdx < 0 && geo) fromIdx = 0; // Si es "Cerca de mí", considera el primer punto como “origen del conductor”
                let toIdx = matchIndexByText(chain, destinoTxt);
                if (toIdx < 0) toIdx = chain.length - 1; // por defecto al destino final

                // Evita incoherencias
                if (fromIdx >= toIdx) {
                  // si viene invertido, fuerza destino final
                  toIdx = chain.length - 1;
                }

                const parcial = calcPartialPrice(r, fromIdx, toIdx);

                const seatsAvail = r.seatsAvailable ?? r.asientosDisponibles ?? "—";
                const veh = r.vehicleType ? r.vehicleType.toUpperCase() : "vehículo";
                const estado = r.status || r.estado || "—";
                const horario = r.schedule?.$date || r.schedule || r.horarioSalida;

                return (
                  <div key={r._id?.$oid || r._id || r.id} className="ruta-card">
                    <div className="ruta-header">
                      <div>
                        <h4>{veh} • {estado}</h4>
                        <div className="muted">
                          {fmtHora(horario)}
                        </div>
                      </div>
                      <div className="precio">
                        ${parcial > 0 ? parcial : (Array.isArray(r.prices) ? r.prices.reduce((a,b)=>a+Number(b||0),0) : (r.price || r.precio || 0))}
                      </div>
                    </div>

                    <div className="ruta-detalles">
                      <div className="ruta-paradas">
                        <div className="parada origen">
                          <span className="parada-punto"></span>
                          <span>{chain[0]?._label || "Origen"}</span>
                        </div>
                        <div className="parada-linea"></div>
                        <div className="parada destino">
                          <span className="parada-punto"></span>
                          <span>{chain.at(-1)?._label || "Destino"}</span>
                        </div>
                      </div>

                      {/* Paradas intermedias (solo etiquetas legibles) */}
                      <div className="paradas-intermedias">
                        <small>
                          {chain.length > 2
                            ? `Paradas: ${chain.slice(1, -1).map(p => p._label).join(" → ")}`
                            : "Sin paradas intermedias"}
                        </small>
                      </div>

                      {/* Detalle técnico sin coords crudas */}
                      <div className="ruta-metadata">
                        <span>🧍 Asientos: {seatsAvail}</span>
                        {Array.isArray(r.prices) ? (
                          <span>💵 Tramos: {r.prices.length} • Total aprox: ${r.prices.reduce((a,b)=>a+Number(b||0),0)}</span>
                        ) : null}
                        <span>🆔 Conductor: {r.driverId ? r.driverId.slice(0,8)+"…" : "—"}</span>
                      </div>
                    </div>

                    <div className="ruta-footer">
                      <button
                        className="btn-reservar"
                        onClick={() => handleReservar(r, parcial)}
                      >
                        Reservar
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
