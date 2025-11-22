// src/pages/conductor/HistorialConductor.jsx
import React, { useState, useEffect, useMemo } from 'react';
import '../../styles/historialConductor.css';

const BASE = "http://localhost:8080";

// Loader para acciones
const ActionLoader = ({ message = "Procesando..." }) => (
  <div className="action-loader">
    <div className="action-loader-spinner"></div>
    <span>{message}</span>
  </div>
);

// Modal para ver identificación del pasajero
const IdentificacionModal = ({ isOpen, onClose, pasajero }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay-conductor">
      <div className="modal-content-conductor modal-identificacion">
        <div className="modal-header-conductor">
          <h3>Identificación del Pasajero</h3>
          <button className="modal-close-conductor" onClick={onClose}>×</button>
        </div>
        <div className="modal-body-conductor">
          <div className="pasajero-info-modal">
            <div><strong>Nombre:</strong> {pasajero?.nombre || "No disponible"}</div>
            <div><strong>Email:</strong> {pasajero?.email || "No disponible"}</div>
            <div><strong>Teléfono:</strong> {pasajero?.telefono || "No disponible"}</div>
          </div>
          {pasajero?.idDocumentUrl ? (
            <div className="identificacion-imagen">
              <img 
                src={pasajero.idDocumentUrl.startsWith('data:') 
                  ? pasajero.idDocumentUrl 
                  : `data:image/jpeg;base64,${pasajero.idDocumentUrl}`} 
                alt="Identificación del pasajero"
                onError={(e) => {
                  e.target.style.display = 'none';
                  e.target.nextSibling.style.display = 'block';
                }}
              />
              <p style={{display: 'none', textAlign: 'center', color: '#666'}}>
                No se pudo cargar la imagen de identificación
              </p>
            </div>
          ) : (
            <div className="sin-identificacion">
              <p>El pasajero no tiene identificación registrada</p>
            </div>
          )}
        </div>
        <div className="modal-actions-conductor">
          <button className="btn-cerrar-modal" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// Modal de cancelación
const CancelarViajeModal = ({ isOpen, onClose, onConfirm, viaje, loading }) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay-conductor">
      <div className="modal-content-conductor">
        <div className="modal-header-conductor">
          <h3>Cancelar Viaje</h3>
          <button className="modal-close-conductor" onClick={onClose}>×</button>
        </div>
        <div className="modal-body-conductor">
          <p>¿Estás seguro de que quieres cancelar este viaje?</p>
          <div className="viaje-info-modal">
            <div><strong>Pasajero:</strong> {viaje?.pasajeroNombre}</div>
            <div><strong>Ruta:</strong> {viaje?.origen} → {viaje?.destino}</div>
            <div><strong>Monto:</strong> ${viaje?.ganancias}</div>
          </div>
          <div className="cancelacion-consecuencias">
            <p>⚠️ Al cancelar:</p>
            <ul>
              <li>El dinero será devuelto al pasajero</li>
              <li>Los asientos se liberarán</li>
              <li>El código de reserva se eliminará</li>
            </ul>
          </div>
        </div>
        <div className="modal-actions-conductor">
          <button className="btn-cancelar-modal" onClick={onClose} disabled={loading}>
            Mantener Viaje
          </button>
          <button className="btn-confirmar-cancelar" onClick={onConfirm} disabled={loading}>
            {loading ? <ActionLoader message="Cancelando..." /> : "Sí, Cancelar Viaje"}
          </button>
        </div>
      </div>
    </div>
  );
};

// Componente ViajeConductorCard actualizado
const ViajeConductorCard = ({ viaje, onCompletarViaje, onCancelarViaje, onVerIdentificacion }) => {
  const [codigoIngresado, setCodigoIngresado] = useState('');
  const [mostrarInputCodigo, setMostrarInputCodigo] = useState(false);
  const [mostrarModalCancelar, setMostrarModalCancelar] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');

  const getEstadoInfo = (estado) => {
    switch(estado) {
      case "completado": return { clase: "completado", texto: "Completado", icono: "✅" };
      case "cancelado": return { clase: "cancelado", texto: "Cancelado", icono: "❌" };
      case "pendiente": return { clase: "pendiente", texto: "Pendiente", icono: "⏳" };
      case "en_curso": return { clase: "en_curso", texto: "En Curso", icono: "🚗" };
      default: return { clase: "", texto: estado, icono: "❓" };
    }
  };

  const estadoInfo = getEstadoInfo(viaje.estado);

  const formatearPrecio = (precio) => {
    if (precio === null || precio === undefined) return "0.00";
    const precioNum = Number(precio);
    return isNaN(precioNum) ? "0.00" : precioNum.toFixed(2);
  };

  const handleCompletarViaje = async () => {
    if (codigoIngresado.length !== 5) {
      alert("El código debe tener exactamente 5 dígitos");
      return;
    }
    setLoadingAction('completar');
    await onCompletarViaje(viaje.id, codigoIngresado);
    setLoadingAction('');
    setCodigoIngresado('');
    setMostrarInputCodigo(false);
  };

  const handleCancelarClick = () => {
    setMostrarModalCancelar(true);
  };

  const confirmarCancelacion = async () => {
    setLoadingAction('cancelar');
    await onCancelarViaje(viaje.id);
    setLoadingAction('');
    setMostrarModalCancelar(false);
  };

  return (
    <div className="conductor-viaje-card">
      {/* Header del viaje */}
      <div className="conductor-viaje-header">
        <div className={`conductor-estado-badge ${estadoInfo.clase}`}>
          {estadoInfo.icono} {estadoInfo.texto}
        </div>
        <div className="conductor-ganancias">${formatearPrecio(viaje.ganancias)}</div>
      </div>

      {/* Información del pasajero */}
      <div className="pasajero-info">
        <div className="pasajero-nombre-rating">
          <span className="pasajero-nombre">{viaje.pasajeroNombre}</span>
          {viaje.pasajeroRating && (
            <span className="pasajero-rating">
              ⭐ {viaje.pasajeroRating}
            </span>
          )}
        </div>
        <div className="pasajero-detalles">
          <span className="pasajero-email">{viaje.pasajeroEmail}</span>
          {viaje.pasajeroTelefono && viaje.pasajeroTelefono !== "No disponible" && (
            <a 
              href={`https://wa.me/52${viaje.pasajeroTelefono.replace(/\D/g, '')}`}
              target="_blank"
              rel="noopener noreferrer"
              className="pasajero-telefono"
              onClick={(e) => e.stopPropagation()}
            >
              📞 {viaje.pasajeroTelefono}
            </a>
          )}
        </div>
      </div>

      {/* Botón para ver identificación - SOLO en viajes pendiente/en_curso */}
      {(viaje.estado === "pendiente" || viaje.estado === "en_curso") && (
        <div className="conductor-acciones-identificacion">
          <button 
            className="btn-ver-identificacion"
            onClick={(e) => {
              e.stopPropagation();
              onVerIdentificacion({
                nombre: viaje.pasajeroNombre,
                email: viaje.pasajeroEmail,
                telefono: viaje.pasajeroTelefono,
                idDocumentUrl: viaje.pasajeroIdDocumentUrl
              });
            }}
          >
            📄 Ver Identificación
          </button>
        </div>
      )}

      {/* Línea de tiempo de la ruta */}
      <div className="conductor-ruta-timeline">
        <div className="conductor-timeline-line"></div>
        <div className="conductor-timeline-stops">
          <div className="conductor-timeline-stop start">
            <div className="conductor-stop-marker"></div>
            <div className="conductor-stop-info">
              <span className="conductor-stop-name">{viaje.origen}</span>
            </div>
          </div>
          
          {viaje.paradas && viaje.paradas.map((parada, index) => (
            <div key={index} className="conductor-timeline-stop intermediate">
              <div className="conductor-stop-marker"></div>
              <div className="conductor-stop-info">
                <span className="conductor-stop-name">{parada}</span>
              </div>
            </div>
          ))}
          
          <div className="conductor-timeline-stop end">
            <div className="conductor-stop-marker"></div>
            <div className="conductor-stop-info">
              <span className="conductor-stop-name">{viaje.destino}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalles del viaje - OCULTAR CÓDIGO AL CONDUCTOR */}
      <div className="conductor-detalles-grid">
        <div className="conductor-detalle-item">
          <span className="conductor-detalle-label">📅 Fecha:</span>
          <span className="conductor-detalle-value">{viaje.fecha} {viaje.hora && `a las ${viaje.hora}`}</span>
        </div>
        <div className="conductor-detalle-item">
          <span className="conductor-detalle-label">💺 Asientos:</span>
          <span className="conductor-detalle-value">{viaje.asientos}</span>
        </div>
        {/* ELIMINADO: Mostrar código de reserva al conductor */}
      </div>

      {/* Sección para completar viaje */}
      {(viaje.estado === "en_curso" || viaje.estado === "pendiente") && (
        <div className="completar-viaje-section">
          {!mostrarInputCodigo ? (
            <div className="codigo-buttons-group">
              <button 
                className="btn-completar-viaje"
                onClick={(e) => {
                  e.stopPropagation();
                  setMostrarInputCodigo(true);
                }}
                disabled={loadingAction}
              >
                {loadingAction === 'completar' ? (
                  <ActionLoader message="Procesando..." />
                ) : (
                  viaje.estado === "pendiente" ? "Iniciar y Completar Viaje" : "Completar Viaje"
                )}
              </button>
            </div>
          ) : (
            <div className="codigo-input-group">
              <div className="codigo-input-header">
                <h4>Ingresar Código de 5 Dígitos</h4>
                <p>Pide al pasajero el código de confirmación</p>
              </div>
              <input 
                type="text" 
                maxLength={5}
                placeholder="00000"
                value={codigoIngresado}
                onChange={(e) => setCodigoIngresado(e.target.value.replace(/\D/g, ''))}
                className="codigo-input"
                disabled={loadingAction}
              />
              <div className="codigo-actions">
                <button 
                  className="btn-confirmar-codigo"
                  onClick={handleCompletarViaje}
                  disabled={codigoIngresado.length !== 5 || loadingAction}
                >
                  {loadingAction === 'completar' ? (
                    <ActionLoader message="Confirmando..." />
                  ) : (
                    "Confirmar Código"
                  )}
                </button>
                <button 
                  className="btn-cancelar-codigo"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMostrarInputCodigo(false);
                    setCodigoIngresado('');
                  }}
                  disabled={loadingAction}
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Acciones de cancelación */}
      <div className="conductor-acciones">
        {(viaje.estado === "pendiente" || viaje.estado === "en_curso") && (
          <div className="acciones-buttons-group">
            <button 
              className="btn-cancelar-viaje" 
              onClick={handleCancelarClick}
              disabled={loadingAction}
            >
              {loadingAction === 'cancelar' ? (
                <ActionLoader message="Cancelando..." />
              ) : (
                "Cancelar Viaje"
              )}
            </button>
          </div>
        )}
      </div>

      {/* Modales */}
      <CancelarViajeModal 
        isOpen={mostrarModalCancelar}
        onClose={() => setMostrarModalCancelar(false)}
        onConfirm={confirmarCancelacion}
        viaje={viaje}
        loading={loadingAction === 'cancelar'}
      />
    </div>
  );
};

export default function HistorialConductor() {
  const [filtro, setFiltro] = useState("todos");
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarModalId, setMostrarModalId] = useState(false);
  const [pasajeroSeleccionado, setPasajeroSeleccionado] = useState(null);

  // ==========================
  // AUTH HELPERS 
  // ==========================
  const getStored = () => {
    const rawUserLS = localStorage.getItem("colibri:user");
    const rawTokLS = localStorage.getItem("colibri:token");
    const rawRefLS = localStorage.getItem("colibri:refresh");
    const rawUserSS = sessionStorage.getItem("colibri:user");
    const rawTokSS = sessionStorage.getItem("colibri:token");
    const rawRefSS = sessionStorage.getItem("colibri:refresh");

    let user = {};
    try {
      user = rawUserLS ? JSON.parse(rawUserLS) : rawUserSS ? JSON.parse(rawUserSS) : {};
    } catch {}

    const candidatesAccess = [
      rawTokLS, rawTokSS, user?.token, user?.accessToken, 
      user?.access_token, user?.idToken, user?.auth?.accessToken, 
      user?.auth?.token,
    ].filter(Boolean);

    const candidatesRefresh = [
      rawRefLS, rawRefSS, user?.refreshToken, user?.refresh_token, 
      user?.rt, user?.auth?.refreshToken
    ].filter(Boolean);

    const access = (candidatesAccess[0] || "").trim();
    const refresh = (candidatesRefresh[0] || "").trim();

    return { access, refresh, user };
  };

  const buildAuthHeaders = () => {
    let { access } = getStored();
    const hasBearer = /^Bearer\s+/i.test(access);
    const authValue = access ? (hasBearer ? access : `Bearer ${access}`) : "";
    
    const h = {
      "content-type": "application/json",
      "Cache-Control": "no-cache"
    };
    if (authValue) h.authorization = authValue;
    return h;
  };

  const fetchJSONWithAuth = async (url, options = {}) => {
    const headers = {
      ...buildAuthHeaders(),
      ...(options.headers || {})
    };
    
    const separator = url.includes('?') ? '&' : '?';
    const finalUrl = `${url}${separator}_=${Date.now()}`;
    
    const res = await fetch(finalUrl, {
      ...options,
      headers,
      credentials: 'include'
    });
    return res;
  };

  // ==========================
  // FUNCIONES PARA OBTENER DATOS DEL PASAJERO (INCLUYENDO IDENTIFICACIÓN)
  // ==========================
  // FUNCIÓN CORREGIDA PARA OBTENER DATOS DEL PASAJERO
const fetchPasajeroInfo = async (pasajeroId) => {
  if (!pasajeroId) {
    return { 
      pasajeroNombre: "Pasajero",
      pasajeroEmail: "Email no disponible",
      pasajeroTelefono: "No disponible",
      pasajeroRating: null,
      pasajeroIdDocumentUrl: null
    };
  }

  let nombre = "Pasajero";
  let email = "No disponible";
  let telefono = "No disponible";
  let rating = null;
  let idDocumentUrl = null;

  try {
    // ============================
    // 1. Primero AUTH (como PerfilPasajero)
    // ============================
    const authRes = await fetchJSONWithAuth(`${BASE}/auth/user/${pasajeroId}`);
    if (authRes.ok) {
      const userData = await authRes.json().catch(() => ({}));
      nombre = userData.full_name || userData.name || "Pasajero";
      email = userData.email || "No disponible";
      telefono = userData.phone_number || "No disponible";
    }

    // ============================
    // 2. Luego CUSTOMERS (si existe)
    // ============================
    const custRes = await fetchJSONWithAuth(`${BASE}/users/customers/${pasajeroId}`);
    if (custRes.ok) {
      const custData = await custRes.json().catch(() => ({}));
      rating = custData.rating_avg || custData.rating || null;

      // preferencias pueden estar en texto
      let prefs = {};
      try {
        prefs = typeof custData.preferences === "string"
          ? JSON.parse(custData.preferences)
          : custData.preferences || {};
      } catch {
        prefs = {};
      }

      idDocumentUrl = prefs.id_document_url || null;

      // Si users.customers tiene teléfono, úsalo
      if (custData.phone_number) telefono = custData.phone_number;
    }

  } catch (error) {
    console.error("❌ Error en fetchPasajeroInfo:", error);
  }

  return { 
    pasajeroNombre: nombre,
    pasajeroEmail: email,
    pasajeroTelefono: telefono,
    pasajeroRating: rating ? Number(rating).toFixed(1) : null,
    pasajeroIdDocumentUrl: idDocumentUrl
  };
};


  // ... (las funciones fetchRouteInfo, obtenerNombreUbicacion se mantienen igual)
  const fetchRouteInfo = async (routeId) => {
    if (!routeId) return { origin: null, destination: null, stops: [] };
    try {
      console.log(`🛣️ Solicitando datos de la ruta con routeId: ${routeId}`);
      const rutaRes = await fetch(`${BASE}/api/routes/${routeId}`);
      console.log(`🛣️ Respuesta de la ruta:`, rutaRes.status);
      
      if (rutaRes.ok) {
        const rutaData = await rutaRes.json().catch(() => ({}));
        console.log("🗺️ Datos completos de la ruta:", rutaData);
        return rutaData;
      } else {
        console.warn(`🛣️ No se pudo obtener información de la ruta ${routeId}, status: ${rutaRes.status}`);
        return { origin: null, destination: null, stops: [] };
      }
    } catch (error) {
      console.error("❌ Error obteniendo ruta:", error);
      return { origin: null, destination: null, stops: [] };
    }
  };

  const reverseCache = useMemo(() => new Map(), []);
  const obtenerNombreUbicacion = async (punto, tipo) => {
    if (!punto) return `${tipo} no disponible`;
    if (punto.address) return punto.address;
    
    if (!punto.coordinates || !Array.isArray(punto.coordinates)) {
      return `${tipo} no disponible`;
    }

    const [lng, lat] = punto.coordinates;
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    
    if (reverseCache.has(key)) return reverseCache.get(key);

    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1&email=soporte@colibri.local`;
      const res = await fetch(url, { headers: { "Accept-Language": "es" } });
      
      if (res.ok) {
        const data = await res.json();
        const address = data?.address || {};
        const line1 = address.road || address.pedestrian || address.cycleway || address.path || address.residential || data?.name;
        const area = address.suburb || address.neighbourhood || address.village || address.town || address.city || address.municipality || address.state_district;
        
        let label = "";
        if (line1 && area) {
          label = `${line1}, ${area}`;
        } else if (data?.name) {
          label = data.name;
        } else if (data?.display_name) {
          const parts = data.display_name.split(",").map(s => s.trim());
          label = parts.slice(0, 2).join(", ");
        }
        
        if (label) {
          reverseCache.set(key, label);
          return label;
        }
      }
    } catch (error) {
      console.warn("Error en reverse geocoding:", error);
    }

    const fallback = `${tipo} (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    reverseCache.set(key, fallback);
    return fallback;
  };

  // ==========================
  // CARGAR VIAJES DEL CONDUCTOR 
  // ==========================
  const cargarViajesConductor = async () => {
    const { user } = getStored();
    const conductorId = user?.id || user?.userId || user?.uid || user?.sub;
    
    if (!conductorId) {
      setError("No se pudo identificar al conductor");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError(null);
      console.log("🟡 Buscando viajes para conductorId:", conductorId);

      // 1. Obtener TODAS las reservas
      const reservasRes = await fetchJSONWithAuth(`${BASE}/api/reservations`);
      console.log("🔵 Status respuesta:", reservasRes.status);
      
      if (!reservasRes.ok) {
        throw new Error(`Error ${reservasRes.status} al cargar viajes`);
      }

      let todasLasReservas = await reservasRes.json();
      console.log("🟣 TODAS las reservas obtenidas:", todasLasReservas);

      if (!Array.isArray(todasLasReservas)) {
        if (todasLasReservas && typeof todasLasReservas === 'object') {
          for (const key in todasLasReservas) {
            if (Array.isArray(todasLasReservas[key])) {
              todasLasReservas = todasLasReservas[key];
              break;
            }
          }
        }
        if (!Array.isArray(todasLasReservas)) {
          todasLasReservas = [];
        }
      }

      // 2. Filtrar las reservas del conductor
      const viajesDelConductor = todasLasReservas.filter(reserva => {
        const reservaConductorId = reserva.driver_id || reserva.driverId;
        return reservaConductorId === conductorId;
      });

      console.log("🟢 Viajes del conductor filtrados:", viajesDelConductor);

      if (viajesDelConductor.length === 0) {
        console.log("ℹ️ No se encontraron viajes para este conductor");
        setViajes([]);
        setCargando(false);
        return;
      }

      // 3. Enriquecer cada viaje con datos del pasajero y ruta
      const viajesEnriquecidos = await Promise.all(
        viajesDelConductor.map(async (reserva, index) => {
          try {
            const routeId = reserva.route_id || reserva.routeId;
            const pasajeroId = reserva.passenger_id || reserva.passengerId;
            
            let rutaData = {};
            let pasajeroData = {};

            // Obtener datos de la ruta usando el endpoint correcto
            if (routeId) {
              rutaData = await fetchRouteInfo(routeId);
            } else {
              console.warn("⚠️ Reserva sin routeId, no se puede obtener información de la ruta");
            }

            // Obtener datos del pasajero (INCLUYENDO IDENTIFICACIÓN Y TELÉFONO)
            if (pasajeroId) {
              pasajeroData = await fetchPasajeroInfo(pasajeroId);
            }

            // Obtener nombres de ubicaciones desde la ruta
            let origenLabel = "Origen no disponible";
            let destinoLabel = "Destino no disponible";
            let paradasLabels = [];
            
            if (rutaData.origin) {
              origenLabel = await obtenerNombreUbicacion(rutaData.origin, "Origen");
            }
            if (rutaData.destination) {
              destinoLabel = await obtenerNombreUbicacion(rutaData.destination, "Destino");
            }

            // Obtener paradas si existen
            if (rutaData.stops && Array.isArray(rutaData.stops)) {
              for (const stop of rutaData.stops) {
                const stopLabel = await obtenerNombreUbicacion(stop, "Parada");
                paradasLabels.push(stopLabel);
              }
            }

            // Mapear estado de la reserva
            const estadoMap = {
              'PENDING': 'pendiente',
              'CONFIRMED': 'en_curso', 
              'COMPLETED': 'completado',
              'CANCELLED': 'cancelado',
              'ACTIVE': 'en_curso'
            };

            // Convertir precio a número de forma segura
            const ganancias = reserva.price;
            const gananciasNum = ganancias !== null && ganancias !== undefined ? Number(ganancias) : 0;
            const gananciasFinal = isNaN(gananciasNum) ? 0 : gananciasNum;

            const viajeEnriquecido = {
              id: reserva._id || reserva.id || `temp-${index}`,
              pasajeroNombre: pasajeroData.pasajeroNombre,
              pasajeroEmail: pasajeroData.pasajeroEmail,
              pasajeroTelefono: pasajeroData.pasajeroTelefono,
              pasajeroRating: pasajeroData.pasajeroRating,
              pasajeroIdDocumentUrl: pasajeroData.pasajeroIdDocumentUrl,
              origen: origenLabel,
              destino: destinoLabel,
              paradas: paradasLabels,
              fecha: reserva.pickup_at ? new Date(reserva.pickup_at).toLocaleDateString("es-MX") : 
                    reserva.created_at ? new Date(reserva.created_at).toLocaleDateString("es-MX") : "Fecha no disponible",
              hora: reserva.pickup_at ? new Date(reserva.pickup_at).toLocaleTimeString("es-MX", { hour: '2-digit', minute: '2-digit' }) : "",
              ganancias: gananciasFinal,
              asientos: reserva.seats || "No especificado",
              estado: estadoMap[reserva.status] || reserva.status?.toLowerCase() || "pendiente",
              codigoReserva: reserva.code || "N/A", // Este código NO se mostrará al conductor
              reservationData: reserva
            };

            console.log(`✅ Viaje conductor enriquecido ${index + 1}:`, viajeEnriquecido);
            return viajeEnriquecido;

          } catch (error) {
            console.error(`❌ Error enriqueciendo viaje conductor ${index}:`, error);
            return null;
          }
        })
      );

      // Filtrar nulls y ordenar por fecha más reciente
      const viajesFiltrados = viajesEnriquecidos.filter(v => v !== null);
      viajesFiltrados.sort((a, b) => {
        const dateA = new Date(a.reservationData.pickup_at || a.reservationData.created_at || 0);
        const dateB = new Date(b.reservationData.pickup_at || b.reservationData.created_at || 0);
        return dateB - dateA;
      });

      console.log("🎉 Viajes conductor finales para mostrar:", viajesFiltrados);
      setViajes(viajesFiltrados);

    } catch (error) {
      console.error("❌ Error cargando historial conductor:", error);
      setError(`No se pudieron cargar los viajes: ${error.message}`);
    } finally {
      setCargando(false);
    }
  };

  // ==========================
  // COMPLETAR VIAJE
  // ==========================
  const completarViaje = async (viajeId, codigo) => {
    try {
      console.log("🚀 Iniciando completado de viaje:", { viajeId, codigo });

      // 1. Verificar el código con el de la reserva
      const viaje = viajes.find(v => v.id === viajeId);
      if (!viaje) {
        throw new Error("Viaje no encontrado");
      }

      // Verificar que el código coincida
      if (viaje.codigoReserva !== codigo) {
        throw new Error("Código incorrecto");
      }

      // 2. PRIMERO: Procesar el pago usando el nuevo endpoint
      const { user } = getStored();
      const conductorId = user?.id || user?.userId || user?.uid || user?.sub;
      const pasajeroId = viaje.reservationData.passenger_id || viaje.reservationData.passengerId;
      
      console.log("💰 Procesando pago con nuevo endpoint...", { 
        reservation_id: viajeId, 
        passenger_id: pasajeroId, 
        driver_id: conductorId, 
        amount_cents: Math.round(viaje.ganancias * 100) 
      });

      const paymentRes = await fetchJSONWithAuth(`${BASE}/api/wallet/complete-trip`, {
        method: "POST",
        body: JSON.stringify({
          reservation_id: viajeId,
          passenger_id: pasajeroId,
          driver_id: conductorId,
          amount_cents: Math.round(viaje.ganancias * 100) // Convertir a centavos
        })
      });

      if (!paymentRes.ok) {
        const errorText = await paymentRes.text();
        console.error("❌ Error en procesamiento de pago:", errorText);
        
        // Intentar obtener más detalles de los holds
        try {
          const holdsRes = await fetchJSONWithAuth(`${BASE}/api/wallet/holds-by-reservation/${viajeId}`);
          if (holdsRes.ok) {
            const holds = await holdsRes.json();
            console.log("📋 Holds encontrados para esta reservación:", holds);
          }
        } catch (holdsError) {
          console.log("No se pudieron obtener detalles de holds:", holdsError);
        }
        
        throw new Error(`Error ${paymentRes.status} al procesar el pago: ${errorText}`);
      }

      const paymentResult = await paymentRes.json();
      console.log("✅ Pago procesado exitosamente:", paymentResult);

      // 3. SEGUNDO: Completar la reserva en el backend
      console.log("📝 Cambiando estado de reserva a COMPLETED...");
      const res = await fetchJSONWithAuth(`${BASE}/api/reservations/${viajeId}/complete`, {
        method: "POST",
        body: JSON.stringify({ code: codigo })
      });

      if (!res.ok) {
        const errorText = await res.text();
        console.error("❌ Error en completar reserva:", errorText);
        
        // Aunque falló completar la reserva, el pago ya se procesó
        // Podríamos considerar revertir el pago en este caso
        console.warn("⚠️ Pago procesado pero reserva no completada. Se requiere intervención manual.");
        throw new Error(`Error ${res.status} al completar el viaje: ${errorText}`);
      }

      const reservaCompletada = await res.json();
      console.log("✅ Reserva completada:", reservaCompletada);

      // 4. Recargar la lista para reflejar el nuevo estado
      await cargarViajesConductor();
      
      // Mostrar resumen del pago
      alert(`✅ Viaje completado exitosamente.\n\nGanancias: $${viaje.ganancias}\nSaldo conductor: $${(Number(paymentResult.driver.new_balance) / 100).toFixed(2)}`);

    } catch (error) {
      console.error("❌ Error completando viaje:", error);
      
      // Mensaje de error más específico
      if (error.message.includes("Código incorrecto")) {
        alert("❌ Código incorrecto. Por favor verifica el código con el pasajero.");
      } else if (error.message.includes("Fondos insuficientes")) {
        alert("❌ Fondos insuficientes en la reservación. Contacta al soporte.");
      } else if (error.message.includes("No se encontraron fondos retenidos")) {
        alert("❌ No se encontraron fondos retenidos para esta reservación. Contacta al soporte.");
      } else if (error.message.includes("404")) {
        alert("❌ Error: Endpoint no encontrado. Contacta al soporte técnico.");
      } else {
        alert(`❌ No se pudo completar el viaje: ${error.message}`);
      }
      throw error; // Re-lanzar para que el loader se detenga
    }
  };

  // ==========================
  // CANCELAR VIAJE
  // ==========================
  const cancelarViaje = async (viajeId) => {
    try {
      const viaje = viajes.find(v => v.id === viajeId);
      if (!viaje) {
        throw new Error("Viaje no encontrado");
      }

      const pasajeroId = viaje.reservationData.passenger_id || viaje.reservationData.passengerId;
      const routeId = viaje.reservationData.route_id || viaje.reservationData.routeId;
      const seats = viaje.reservationData.seats || 1;

      console.log("🚫 Iniciando cancelación de viaje:", {
        viajeId,
        pasajeroId,
        routeId,
        seats,
        monto: viaje.ganancias
      });

      // 1. Buscar los holds específicos para esta reservación
      let holds = [];
      try {
        const holdsRes = await fetchJSONWithAuth(`${BASE}/api/wallet/holds-by-reservation/${viajeId}`);
        if (holdsRes.ok) {
          holds = await holdsRes.json();
          console.log("📋 Holds encontrados:", holds);
        }
      } catch (error) {
        console.warn("No se pudieron obtener los holds:", error);
      }

      // 2. Liberar cada hold activo
      if (holds && holds.length > 0) {
        for (const hold of holds) {
          if (!hold.is_released) {
            console.log(`💰 Liberando hold: ${hold.operation_id}`);
            const releaseRes = await fetchJSONWithAuth(`${BASE}/api/wallet/release-hold`, {
              method: "POST",
              body: JSON.stringify({
                operation_id: `release-${viajeId}-${hold.operation_id}-${Date.now()}`,
                user_id: pasajeroId,
                hold_operation_id: hold.operation_id,
                reason: "Viaje cancelado por el conductor",
                reservation_id: viajeId
              })
            });

            if (releaseRes.ok) {
              console.log(`✅ Hold ${hold.operation_id} liberado`);
            } else {
              console.warn(`⚠️ No se pudo liberar el hold ${hold.operation_id}`);
            }
          }
        }
      } else {
        console.warn("⚠️ No se encontraron holds para liberar");
      }

      // 3. Devolver asientos a la ruta
      if (routeId) {
        console.log("🔄 Devolviendo asientos a la ruta...");
        try {
          const routeRes = await fetchJSONWithAuth(`${BASE}/api/routes/${routeId}`);
          if (routeRes.ok) {
            const routeData = await routeRes.json();
            const currentSeats = parseInt(routeData.availableSeats) || 0;
            const newSeats = currentSeats + parseInt(seats);
            
            const updateRes = await fetchJSONWithAuth(`${BASE}/api/routes/${routeId}`, {
              method: "PUT",
              body: JSON.stringify({ availableSeats: newSeats })
            });
            
            if (updateRes.ok) {
              console.log("✅ Asientos devueltos exitosamente");
            } else {
              console.warn("⚠️ No se pudieron devolver los asientos");
            }
          }
        } catch (error) {
          console.warn("⚠️ Error devolviendo asientos:", error);
        }
      }

      // 4. Cancelar la reservación y eliminar el código
      console.log("📝 Cancelando reservación...");
      const cancelRes = await fetchJSONWithAuth(`${BASE}/api/reservations/${viajeId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ 
          status: "CANCELLED",
          code: null // Eliminar el código
        })
      });

      if (!cancelRes.ok) {
        throw new Error("Error al cancelar el viaje");
      }

      // 5. Recargar la lista
      await cargarViajesConductor();
      alert("✅ Viaje cancelado exitosamente. El dinero ha sido devuelto al pasajero y los asientos liberados.");

    } catch (error) {
      console.error("Error cancelando viaje:", error);
      alert("❌ No se pudo cancelar el viaje. Intenta nuevamente.");
      throw error; // Re-lanzar para que el loader se detenga
    }
  };

  // ==========================
  // MANEJAR IDENTIFICACIÓN
  // ==========================
  const handleVerIdentificacion = (pasajero) => {
    setPasajeroSeleccionado(pasajero);
    setMostrarModalId(true);
  };

  // ==========================
  // EFECTOS
  // ==========================
  useEffect(() => {
    cargarViajesConductor();
  }, []);

  // ==========================
  // FILTROS Y ESTADÍSTICAS
  // ==========================
  const viajesFiltrados = useMemo(() => {
    if (filtro === "todos") return viajes;
    if (filtro === "en_curso") return viajes.filter(v => v.estado === "pendiente" || v.estado === "en_curso");
    return viajes.filter(viaje => viaje.estado === filtro);
  }, [viajes, filtro]);

  const estadisticas = useMemo(() => {
    const completados = viajes.filter(v => v.estado === "completado");
    const totalGanado = completados.reduce((sum, v) => {
      const ganancia = Number(v.ganancias) || 0;
      return sum + ganancia;
    }, 0);
    
    const viajesRealizados = completados.length;
    
    return {
      totalViajes: viajesRealizados,
      totalGanado,
      gananciaPromedio: viajesRealizados > 0 ? (totalGanado / viajesRealizados).toFixed(2) : "0.00"
    };
  }, [viajes]);

  // ==========================
  // RENDER
  // ==========================
  return (
    <div className="historial-conductor-container">
      <div className="historial-conductor-header">
        <h1>Mis Viajes</h1>
        <p>Gestiona tus viajes como conductor</p>
      </div>

      {/* Filtros */}
      <div className="conductor-filtros-historial">
        <button className={`conductor-filtro-btn ${filtro === 'todos' ? 'active' : ''}`} onClick={() => setFiltro('todos')}>
          Todos los Viajes
        </button>
        <button className={`conductor-filtro-btn ${filtro === 'completado' ? 'active' : ''}`} onClick={() => setFiltro('completado')}>
          Completados
        </button>
        <button className={`conductor-filtro-btn ${filtro === 'en_curso' ? 'active' : ''}`} onClick={() => setFiltro('en_curso')}>
          En Curso
        </button>
        <button className={`conductor-filtro-btn ${filtro === 'cancelado' ? 'active' : ''}`} onClick={() => setFiltro('cancelado')}>
          Cancelados
        </button>
      </div>

      {/* Estadísticas */}
      {viajes.length > 0 && (
        <div className="conductor-estadisticas-historial">
          <div className="conductor-estadistica-card">
            <div className="conductor-estadistica-icon">🚗</div>
            <div className="conductor-estadistica-info">
              <h3>Total de Viajes</h3>
              <p>{estadisticas.totalViajes}</p>
            </div>
          </div>
          <div className="conductor-estadistica-card">
            <div className="conductor-estadistica-icon">💰</div>
            <div className="conductor-estadistica-info">
              <h3>Total Ganado</h3>
              <p>${estadisticas.totalGanado.toFixed(2)}</p>
            </div>
          </div>
          <div className="conductor-estadistica-card">
            <div className="conductor-estadistica-icon">📊</div>
            <div className="conductor-estadistica-info">
              <h3>Ganancia Promedio</h3>
              <p>${estadisticas.gananciaPromedio}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading y Error */}
      {cargando && (
        <div className="conductor-estado-cargando">
          <div className="conductor-loading-spinner"></div>
          <p>Cargando tus viajes...</p>
        </div>
      )}

      {error && (
        <div className="conductor-estado-error">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={cargarViajesConductor} className="conductor-btn-reintentar">
            Reintentar
          </button>
        </div>
      )}

      {/* Lista de viajes */}
      {!cargando && !error && (
        <div className="conductor-viajes-lista">
          {viajesFiltrados.length === 0 ? (
            <div className="conductor-sin-viajes">
              <h3>No hay viajes {filtro !== "todos" ? `con estado "${filtro}"` : ""}</h3>
              <p>Cuando tengas viajes, aparecerán aquí</p>
              <button onClick={cargarViajesConductor} className="conductor-btn-reintentar">
                Actualizar
              </button>
            </div>
          ) : (
            viajesFiltrados.map((viaje) => (
              <ViajeConductorCard 
                key={viaje.id} 
                viaje={viaje}
                onCompletarViaje={completarViaje}
                onCancelarViaje={cancelarViaje}
                onVerIdentificacion={handleVerIdentificacion}
              />
            ))
          )}
        </div>
      )}

      {/* Modal de identificación */}
      <IdentificacionModal
        isOpen={mostrarModalId}
        onClose={() => setMostrarModalId(false)}
        pasajero={pasajeroSeleccionado}
      />
    </div>
  );
}