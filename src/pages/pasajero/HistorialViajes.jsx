// src/pages/pasajero/HistorialViajes.jsx
import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/pasajero/historialViajes.css";
import { authClient } from "../../lib/authClient";

const BASE = "https://c-apigateway.onrender.com";

// Componente ViajeCard - SIN CAMBIOS
const ViajeCard = ({ viaje, onCancelarClick, onCalificar, onVerIdentificacion }) => {
  const [mostrarCalificacion, setMostrarCalificacion] = useState(false);

  const getEstadoInfo = (estado) => {
    switch (estado) {
      case "completado":
        return { clase: "completado", texto: "Completado", icono: "✅" };
      case "cancelado":
        return { clase: "cancelado", texto: "Cancelado", icono: "❌" };
      case "pendiente":
        return { clase: "pendiente", texto: "Pendiente", icono: "⏳" };
      case "en_curso":
        return { clase: "en_curso", texto: "En Curso", icono: "🚗" };
      default:
        return { clase: "", texto: estado, icono: "❓" };
    }
  };

  const renderEstrellas = (calificacion, interactivo = false, onCalificarCb = null) => {
    if (!calificacion && !interactivo) return "Sin calificar";

    if (interactivo) {
      return (
        <div className="estrellas-interactivas">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              className="estrella-btn"
              onClick={(e) => {
                e.stopPropagation();
                onCalificarCb(star);
              }}
            >
              {star <= (calificacion || 0) ? "⭐" : "☆"}
            </button>
          ))}
        </div>
      );
    }

    return "⭐".repeat(calificacion) + "☆".repeat(5 - calificacion);
  };

  const estadoInfo = getEstadoInfo(viaje.estado);

  const formatearPrecio = (precio) => {
    if (precio === null || precio === undefined) return "0.00";
    const precioNum = Number(precio);
    return isNaN(precioNum) ? "0.00" : precioNum.toFixed(2);
  };

  return (
    <div className="historial-viaje-card">
      {/* Header */}
      <div className="ruta-header">
        <div className={`ruta-badge estado-${viaje.estado}`}>
          {estadoInfo.icono} {estadoInfo.texto}
        </div>
        <div className="ruta-price">${formatearPrecio(viaje.precio)}</div>
      </div>

      {/* Info conductor */}
      <div className="driver-info">
        <div className="driver-name-rating">
          <span className="driver-name">{viaje.conductor}</span>
          {viaje.ratingConductor && (
            <span className="driver-rating">⭐ {viaje.ratingConductor}</span>
          )}
        </div>
        <div className="driver-details">
          <span className="driver-vehicle">{viaje.vehiculo}</span>
          {viaje.phoneConductor && viaje.phoneConductor !== "No disponible" && (
            <a
              href={`https://wa.me/52${viaje.phoneConductor.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="driver-phone"
              onClick={(e) => e.stopPropagation()}
            >
              📞 {viaje.phoneConductor}
            </a>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="ruta-timeline">
        <div className="timeline-line"></div>
        <div className="timeline-stops">
          <div className="timeline-stop start">
            <div className="stop-marker"></div>
            <div className="stop-info">
              <span className="stop-name">{viaje.origen}</span>
            </div>
          </div>

          {viaje.paradas &&
            viaje.paradas.map((parada, index) => (
              <div key={index} className="timeline-stop intermediate">
                <div className="stop-marker"></div>
                <div className="stop-info">
                  <span className="stop-name">{parada}</span>
                </div>
              </div>
            ))}

          <div className="timeline-stop end">
            <div className="stop-marker"></div>
            <div className="stop-info">
              <span className="stop-name">{viaje.destino}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Detalles */}
      <div className="viaje-detalles-grid">
        <div className="detalle-item">
          <span className="detalle-label">📅 Fecha:</span>
          <span className="detalle-value">
            {viaje.fecha} {viaje.hora && `a las ${viaje.hora}`}
          </span>
        </div>
        {viaje.asientos && viaje.asientos !== "No especificado" && (
          <div className="detalle-item">
            <span className="detalle-label">💺 Asientos:</span>
            <span className="detalle-value">{viaje.asientos}</span>
          </div>
        )}
        {viaje.codigoViaje && viaje.codigoViaje !== "N/A" && (
          <div className="detalle-item">
            <span className="detalle-label">🎫 Código:</span>
            <span className="detalle-value codigo-viaje">{viaje.codigoViaje}</span>
          </div>
        )}
      </div>

      {/* Calificación */}
      {viaje.estado === "completado" && (
        <div className="viaje-calificacion">
          <div className="calificacion-header">
            <span>Tu calificación:</span>
            <span className="estrellas">
              {viaje.calificacion ? (
                renderEstrellas(viaje.calificacion)
              ) : mostrarCalificacion ? (
                renderEstrellas(0, true, (calif) => {
                  onCalificar(viaje.id, calif);
                  setMostrarCalificacion(false);
                })
              ) : (
                "Sin calificar"
              )}
            </span>
          </div>
          {!viaje.calificacion && !mostrarCalificacion && (
            <button
              className="btn-calificar"
              onClick={(e) => {
                e.stopPropagation();
                setMostrarCalificacion(true);
              }}
            >
              Calificar Viaje
            </button>
          )}
        </div>
      )}

      {/* Acciones */}
      <div className="viaje-acciones">
        {(viaje.estado === "pendiente" || viaje.estado === "en_curso") && (
          <button
            className="btn-cancelar"
            onClick={(e) => {
              e.stopPropagation();
              onCancelarClick(viaje.id);
            }}
          >
            Cancelar Viaje
          </button>
        )}

        {/* Botón: Ver identificación del conductor (solo en curso y si hay doc) */}
        {viaje.estado === "pendiente" &&
          viaje.conductorData &&
          viaje.conductorData.idDocumentUrl && (
            <button
              className="btn-identificacion"
              onClick={(e) => {
                e.stopPropagation();
                onVerIdentificacion(
                  viaje.conductor,
                  viaje.conductorData.idDocumentUrl
                );
              }}
            >
              Ver identificación
            </button>
          )}
      </div>
    </div>
  );
};

export default function HistorialViajes() {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState("todos");
  const [viajes, setViajes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [mostrarModalExito, setMostrarModalExito] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  // Modal identificación - SIN CAMBIOS
  const [mostrarModalId, setMostrarModalId] = useState(false);
  const [idModalData, setIdModalData] = useState({
    nombre: "",
    imagen: "",
  });

  // 🔹 Estados para la cancelación - CORREGIDO
  const [mostrarModalConfirm, setMostrarModalConfirm] = useState(false);
  const [viajeAEliminar, setViajeAEliminar] = useState(null);
  const [cancelando, setCancelando] = useState(false);

  // ==========================
  // AUTH HELPERS (sin cambios)
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

  const fetchJSONWithAuth = async (
    url,
    options = {},
    opts = { retryOn401: true }
  ) => {
    const separator = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${separator}_=${Date.now()}`;

    const extraHeaders = {
      "Cache-Control": "no-cache",
      ...(options.headers || {}),
    };

    return authClient.fetch(
      finalUrl,
      { ...options, headers: extraHeaders },
      opts
    );
  };

  // ==========================
  // FUNCIONES PARA OBTENER DATOS (sin cambios)
  // ==========================
  const driverCache = useMemo(() => new Map(), []);

  const fetchDriverInfo = async (driverId) => {
    if (!driverId)
      return {
        driverName: "Conductor",
        vehicle: "Vehículo no especificado",
        rating: null,
        phone: "No disponible",
        idDocumentUrl: null,
      };

    if (driverCache.has(driverId)) return driverCache.get(driverId);

    let name = "Conductor";
    let vehicle = "Vehículo no especificado";
    let rating = null;
    let phone = "No disponible";
    let idDocumentUrl = null;

    try {
      console.log(`👤 Solicitando datos del conductor con driverId: ${driverId}`);

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

        vehicle =
          driverData?.vehicle?.model ||
          driverData?.vehicle_brand ||
          driverData?.vehicle_model ||
          "Vehículo no especificado";

        phone =
          driverData?.driver_profile?.phone_number ||
          driverData?.phone_number ||
          driverData?.user?.phone_number ||
          "No disponible";

        idDocumentUrl =
          driverData?.id_document_url ||
          driverData?.driver_profile?.id_document_url ||
          driverData?.profile?.id_document_url ||
          null;

        if (name === "Conductor") {
          name =
            driverData?.user?.full_name ||
            driverData?.full_name ||
            driverData?.name ||
            "Conductor";
        }
      }
    } catch (error) {
      console.error("❌ Error obteniendo perfil conductor:", error);
    }

    const driverInfo = {
      driverName: name,
      vehicle,
      rating: rating ? Number(rating).toFixed(1) : null,
      phone,
      idDocumentUrl,
    };

    driverCache.set(driverId, driverInfo);
    return driverInfo;
  };

  const fetchRouteInfo = async (routeId) => {
    if (!routeId) return { origin: null, destination: null, stops: [] };

    try {
      const rutaRes = await fetchJSONWithAuth(
        `${BASE}/api/routes/${routeId}`,
        { method: "GET" }
      );

      if (rutaRes.ok) {
        const rutaData = await rutaRes.json().catch(() => ({}));
        return rutaData;
      } else {
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
        const line1 =
          address.road ||
          address.pedestrian ||
          address.cycleway ||
          address.path ||
          address.residential ||
          data?.name;
        const area =
          address.suburb ||
          address.neighbourhood ||
          address.village ||
          address.town ||
          address.city ||
          address.municipality ||
          address.state_district;

        let label = "";
        if (line1 && area) label = `${line1}, ${area}`;
        else if (data?.name) label = data.name;
        else if (data?.display_name) {
          const parts = data.display_name.split(",").map((s) => s.trim());
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
  // CARGAR DATOS (sin cambios)
  // ==========================
  const cargarReservas = async () => {
    const { user } = getStored();
    const passengerId = user?.id || user?.userId || user?.uid || user?.sub;

    if (!passengerId) {
      setError("No se pudo identificar al usuario");
      setCargando(false);
      return;
    }

    try {
      setCargando(true);
      setError(null);

      const reservasRes = await fetchJSONWithAuth(`${BASE}/api/reservations`);

      if (reservasRes.status === 401) {
        setError("Tu sesión ha expirado. Vuelve a iniciar sesión.");
        setCargando(false);
        return;
      }

      if (!reservasRes.ok) {
        throw new Error(`Error ${reservasRes.status} al cargar reservas`);
      }

      let todasLasReservas = await reservasRes.json();

      if (!Array.isArray(todasLasReservas)) {
        if (todasLasReservas && typeof todasLasReservas === "object") {
          for (const key in todasLasReservas) {
            if (Array.isArray(todasLasReservas[key])) {
              todasLasReservas = todasLasReservas[key];
              break;
            }
          }
        }
        if (!Array.isArray(todasLasReservas)) todasLasReservas = [];
      }

      const reservasDelUsuario = todasLasReservas.filter((reserva) => {
        const reservaPassengerId =
          reserva.passengerId || reserva.passenger_id || reserva.passengerID;
        return reservaPassengerId === passengerId;
      });

      if (reservasDelUsuario.length === 0) {
        setViajes([]);
        setCargando(false);
        return;
      }

      const viajesEnriquecidos = await Promise.all(
        reservasDelUsuario.map(async (reserva, index) => {
          try {
            const routeId = reserva.route_id || reserva.routeId;
            const driverId = reserva.driver_id || reserva.driverId;

            let rutaData = {};
            let conductorData = {};

            if (routeId) {
              rutaData = await fetchRouteInfo(routeId);
            }
            if (driverId) {
              conductorData = await fetchDriverInfo(driverId);
            }

            let origenLabel = "Origen no disponible";
            let destinoLabel = "Destino no disponible";
            let paradasLabels = [];

            if (rutaData.origin) {
              origenLabel = await obtenerNombreUbicacion(
                rutaData.origin,
                "Origen"
              );
            }
            if (rutaData.destination) {
              destinoLabel = await obtenerNombreUbicacion(
                rutaData.destination,
                "Destino"
              );
            }

            if (rutaData.stops && Array.isArray(rutaData.stops)) {
              for (const stop of rutaData.stops) {
                const stopLabel = await obtenerNombreUbicacion(
                  stop,
                  "Parada"
                );
                paradasLabels.push(stopLabel);
              }
            }

            const estadoMap = {
              PENDING: "pendiente",
              CONFIRMED: "en_curso",
              COMPLETED: "completado",
              CANCELLED: "cancelado",
              ACTIVE: "en_curso",
            };

            const precio = reserva.price;
            const precioNum =
              precio !== null && precio !== undefined ? Number(precio) : 0;
            const precioFinal = isNaN(precioNum) ? 0 : precioNum;

            const viajeEnriquecido = {
              id: reserva._id || reserva.id || `temp-${index}`,
              conductor:
                conductorData.driverName || "Conductor no disponible",
              origen: origenLabel,
              destino: destinoLabel,
              paradas: paradasLabels,
              fecha: reserva.pickup_at
                ? new Date(reserva.pickup_at).toLocaleDateString("es-MX")
                : reserva.created_at
                ? new Date(reserva.created_at).toLocaleDateString("es-MX")
                : "Fecha no disponible",
              hora: reserva.pickup_at
                ? new Date(reserva.pickup_at).toLocaleTimeString("es-MX", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "",
              precio: precioFinal,
              estado:
                estadoMap[reserva.status] ||
                reserva.status?.toLowerCase() ||
                "pendiente",
              calificacion: reserva.rating || null,
              vehiculo: conductorData.vehicle || "Vehículo no disponible",
              ratingConductor: conductorData.rating,
              phoneConductor: conductorData.phone,
              codigoViaje: reserva.code || "N/A",
              asientos: reserva.seats || "No especificado",
              reservationData: reserva,
              routeData: rutaData,
              conductorData: conductorData,
            };

            return viajeEnriquecido;
          } catch (error) {
            console.error(`❌ Error enriqueciendo reserva ${index}:`, error);
            return {
              id: reserva._id || reserva.id || `temp-${index}`,
              conductor: "Error al cargar",
              origen: "Origen no disponible",
              destino: "Destino no disponible",
              paradas: [],
              fecha: "Fecha no disponible",
              hora: "",
              precio: reserva.price || 0,
              estado: "pendiente",
              calificacion: null,
              vehiculo: "Vehículo no disponible",
              codigoViaje: reserva.code || "N/A",
              asientos: reserva.seats || "No especificado",
              reservationData: reserva,
            };
          }
        })
      );

      const viajesFiltrados = viajesEnriquecidos.filter((v) => v !== null);
      viajesFiltrados.sort((a, b) => {
        const dateA = new Date(
          a.reservationData.pickup_at || a.reservationData.created_at || 0
        );
        const dateB = new Date(
          b.reservationData.pickup_at || b.reservationData.created_at || 0
        );
        return dateB - dateA;
      });

      setViajes(viajesFiltrados);
    } catch (error) {
      console.error("❌ Error cargando historial:", error);
      setError(`No se pudieron cargar los viajes: ${error.message}`);
    } finally {
      setCargando(false);
    }
  };

  // ==========================
  // ACCIONES - CANCELACIÓN CORREGIDA
  // ==========================
  const cancelarViaje = async (viajeId) => {
    try {
      setCancelando(true);
      
      const { user } = getStored();
      const passengerId = user?.id || user?.userId || user?.uid || user?.sub;
      
      if (!passengerId) {
        alert("No se pudo identificar al usuario.");
        setCancelando(false);
        return;
      }

      const viaje = viajes.find(v => v.id === viajeId);
      if (!viaje) {
        alert("No se encontró el viaje.");
        setCancelando(false);
        return;
      }

      const reservationData = viaje.reservationData;
      const routeId = reservationData.route_id || reservationData.routeId;
      const seatsToReturn = reservationData.seats || 1;
      const amountToRelease = Math.round((viaje.precio || 0) * 100);

      // 1. BUSCAR EL HOLD_OPERATION_ID
      let holdOperationId = null;
      try {
        const ledgerRes = await fetchJSONWithAuth(
          `${BASE}/api/wallet/ledger/${passengerId}?limit=100`
        );
        
        if (ledgerRes.ok) {
          const ledger = await ledgerRes.json();
          const holdEntry = ledger.find(entry => 
            entry.type === "HOLD" && 
            entry.related_reservation === viajeId &&
            Number(entry.amount_cents) === -amountToRelease
          );
          
          if (holdEntry) {
            holdOperationId = holdEntry.operation_id;
          } else {
            const approximateHold = ledger.find(entry => 
              entry.type === "HOLD" && 
              entry.related_reservation === viajeId
            );
            if (approximateHold) {
              holdOperationId = approximateHold.operation_id;
            }
          }
        }
      } catch (error) {
        console.error("❌ Error obteniendo ledger:", error);
      }

      // 2. LIBERAR EL DINERO RETENIDO
      if (holdOperationId) {
        try {
          const releaseOperationId = `release-${viajeId}-${Date.now()}`;
          
          const releaseRes = await fetchJSONWithAuth(
            `${BASE}/api/wallet/release`,
            {
              method: "POST",
              body: JSON.stringify({
                operation_id: releaseOperationId,
                user_id: passengerId,
                hold_operation_id: holdOperationId,
                reason: "Cancelación de viaje",
                reservation_id: viajeId
              })
            }
          );

          if (releaseRes.ok) {
            console.log("✅ Dinero liberado exitosamente");
          } else {
            console.warn("⚠️ No se pudo liberar el dinero");
          }
        } catch (error) {
          console.error("❌ Error liberando dinero:", error);
        }
      }

      // 3. DEVOLVER ASIENTOS A LA RUTA
      if (routeId) {
        try {
          const routeRes = await fetchJSONWithAuth(
            `${BASE}/api/routes/${routeId}`,
            { method: "GET" }
          );

          if (routeRes.ok) {
            const routeData = await routeRes.json();
            const currentSeats = Number(routeData.availableSeats) || 0;
            const newSeats = currentSeats + seatsToReturn;

            const updateRes = await fetchJSONWithAuth(
              `${BASE}/api/routes/${routeId}`,
              {
                method: "PUT",
                body: JSON.stringify({ 
                  availableSeats: newSeats 
                })
              }
            );

            if (updateRes.ok) {
              console.log("✅ Asientos devueltos exitosamente");
            }
          }
        } catch (error) {
          console.error("❌ Error devolviendo asientos:", error);
        }
      }

      // 4. CANCELAR LA RESERVACIÓN
      try {
        const cancelRes = await fetchJSONWithAuth(
          `${BASE}/api/reservations/${viajeId}`,
          {
            method: "PATCH",
            body: JSON.stringify({ 
              status: "CANCELLED",
              code: null
            })
          }
        );

        if (cancelRes.ok) {
          console.log("✅ Reservación cancelada y código removido");
          
          // 🔹 CORRECCIÓN: Cerrar el modal de confirmación ANTES de mostrar el de éxito
          setMostrarModalConfirm(false);
          setMensajeExito(
            "Viaje cancelado exitosamente. El dinero ha sido reembolsado y los asientos liberados."
          );
          setMostrarModalExito(true);
          
          await cargarReservas();
        } else {
          throw new Error("Error cancelando reservación");
        }
      } catch (error) {
        console.error("❌ Error cancelando reservación:", error);
        alert("No se pudo cancelar la reservación. Intenta nuevamente.");
      }

    } catch (error) {
      console.error("❌ Error general cancelando viaje:", error);
      alert("No se pudo completar la cancelación. Intenta nuevamente.");
    } finally {
      setCancelando(false);
    }
  };

  // 🔹 Flow de cancelación - CORREGIDO
  const handleSolicitarCancelacion = (viajeId) => {
    setViajeAEliminar(viajeId);
    setMostrarModalConfirm(true);
  };

  const calificarViaje = async (viajeId, calificacion) => {
    try {
      const res = await fetchJSONWithAuth(
        `${BASE}/api/reservations/${viajeId}`,
        {
          method: "PATCH",
          body: JSON.stringify({ rating: calificacion }),
        }
      );

      if (res.ok) {
        await cargarReservas();
      } else {
        throw new Error("Error al calificar el viaje");
      }
    } catch (error) {
      console.error("Error calificando viaje:", error);
      alert("No se pudo calificar el viaje. Intenta nuevamente.");
    }
  };

  // 🔹 Handler para ver identificación - SIN CAMBIOS
  const handleVerIdentificacion = (nombreConductor, idDocumentUrl) => {
    if (!idDocumentUrl) {
      alert("El conductor no tiene identificación registrada.");
      return;
    }

    const imagenSrc = idDocumentUrl.startsWith("data:")
      ? idDocumentUrl
      : `data:image/jpeg;base64,${idDocumentUrl}`;

    setIdModalData({
      nombre: nombreConductor || "Conductor",
      imagen: imagenSrc,
    });
    setMostrarModalId(true);
  };

  // ==========================
  // EFECTOS
  // ==========================
  useEffect(() => {
    cargarReservas();
  }, []);

  // ==========================
  // FILTROS Y ESTADÍSTICAS (sin cambios)
  // ==========================
  const viajesFiltrados = useMemo(() => {
    if (filtro === "todos") return viajes;
    if (filtro === "en_curso")
      return viajes.filter(
        (v) => v.estado === "pendiente" || v.estado === "en_curso"
      );
    return viajes.filter((viaje) => viaje.estado === filtro);
  }, [viajes, filtro]);

  const estadisticas = useMemo(() => {
    const completados = viajes.filter((v) => v.estado === "completado");

    const totalGastado = completados.reduce((sum, v) => {
      const precio = Number(v.precio) || 0;
      return sum + precio;
    }, 0);

    const viajesCalificados = completados.filter((v) => v.calificacion);
    const ratingPromedio =
      viajesCalificados.length > 0
        ? (
            viajesCalificados.reduce(
              (sum, v) => sum + (Number(v.calificacion) || 0),
              0
            ) / viajesCalificados.length
          ).toFixed(1)
        : "0.0";

    return {
      totalViajes: completados.length,
      totalGastado,
      ratingPromedio,
    };
  }, [viajes]);

  // ==========================
  // RENDER
  // ==========================
  return (
    <div className="historial-viajes">
      <div className="historial-header">
        <h1>Mis Viajes</h1>
      </div>

      {/* Filtros */}
      <div className="filtros-historial">
        <button
          className={`filtro-btn ${filtro === "todos" ? "active" : ""}`}
          onClick={() => setFiltro("todos")}
        >
          Todos los Viajes
        </button>
        <button
          className={`filtro-btn ${filtro === "completado" ? "active" : ""}`}
          onClick={() => setFiltro("completado")}
        >
          Completados
        </button>
        <button
          className={`filtro-btn ${filtro === "en_curso" ? "active" : ""}`}
          onClick={() => setFiltro("en_curso")}
        >
          En Curso
        </button>
        <button
          className={`filtro-btn ${filtro === "cancelado" ? "active" : ""}`}
          onClick={() => setFiltro("cancelado")}
        >
          Cancelados
        </button>
      </div>

      {/* Estadísticas */}
      {viajes.length > 0 && (
        <div className="estadisticas-historial">
          <div className="estadistica-card">
            <div className="estadistica-icon">🚗</div>
            <div className="estadistica-info">
              <h3>Total de Viajes</h3>
              <p>{estadisticas.totalViajes}</p>
            </div>
          </div>

          <div className="estadistica-card">
            <div className="estadistica-icon">💰</div>
            <div className="estadistica-info">
              <h3>Total Gastado</h3>
              <p>${estadisticas.totalGastado.toFixed(2)}</p>
            </div>
          </div>

          <div className="estadistica-card">
            <div className="estadistica-icon">⭐</div>
            <div className="estadistica-info">
              <h3>Rating Promedio</h3>
              <p>{estadisticas.ratingPromedio}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading y Error */}
      {cargando && (
        <div className="estado-cargando">
          <div className="loading-spinner"></div>
          <p>Cargando tus viajes...</p>
        </div>
      )}

      {error && (
        <div className="estado-error">
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={cargarReservas} className="btn-reintentar">
            Reintentar
          </button>
        </div>
      )}

      {/* Lista de viajes */}
      {!cargando && !error && (
        <div className="viajes-lista">
          {viajesFiltrados.length === 0 ? (
            <div className="sin-viajes">
              <h3>
                No hay viajes{" "}
                {filtro !== "todos" ? `con estado "${filtro}"` : ""}
              </h3>
              <p>Cuando realices viajes, aparecerán aquí</p>
              <button onClick={cargarReservas} className="btn-reintentar">
                Actualizar
              </button>
            </div>
          ) : (
            viajesFiltrados.map((viaje) => (
              <ViajeCard
                key={viaje.id}
                viaje={viaje}
                onCancelarClick={handleSolicitarCancelacion}
                onCalificar={calificarViaje}
                onVerIdentificacion={handleVerIdentificacion}
              />
            ))
          )}
        </div>
      )}

      {/* Modal de éxito personalizado */}
      {mostrarModalExito && (
        <div
          className="modal-overlay-custom"
          onClick={() => setMostrarModalExito(false)}
        >
          <div
            className="modal-card-custom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-custom">
              <h3>✅ Cancelación Exitosa</h3>
              <button
                className="modal-close-custom"
                onClick={() => setMostrarModalExito(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body-custom">
              <p>{mensajeExito}</p>
            </div>
            <div className="modal-footer-custom">
              <button
                className="btn-primary-custom"
                onClick={() => setMostrarModalExito(false)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para ver identificación del conductor - SIN CAMBIOS */}
      {mostrarModalId && (
        <div
          className="modal-overlay-custom"
          onClick={() => setMostrarModalId(false)}
        >
          <div
            className="modal-card-custom modal-id-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-custom">
              <h3>Identificación del conductor</h3>
              <button
                className="modal-close-custom"
                onClick={() => setMostrarModalId(false)}
              >
                ×
              </button>
            </div>
            <div className="modal-body-custom">
              <p className="modal-id-nombre">
                {idModalData.nombre || "Conductor"}
              </p>
              {idModalData.imagen ? (
                <img
                  src={idModalData.imagen}
                  alt="Identificación del conductor"
                  className="id-image"
                />
              ) : (
                <p>No hay identificación disponible.</p>
              )}
            </div>
            <div className="modal-footer-custom">
              <button
                className="btn-primary-custom"
                onClick={() => setMostrarModalId(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔹 Modal de confirmación de cancelación CORREGIDO */}
      {mostrarModalConfirm && (
        <div
          className="modal-overlay-custom"
          onClick={() => !cancelando && setMostrarModalConfirm(false)}
        >
          <div
            className="modal-card-custom"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header-custom">
              <h3>Confirmar cancelación</h3>
              <button
                className="modal-close-custom"
                onClick={() => !cancelando && setMostrarModalConfirm(false)}
                disabled={cancelando}
              >
                ×
              </button>
            </div>
            <div className="modal-body-custom">
              {cancelando ? (
                <div className="cancelacion-cargando">
                  <div className="loading-spinner-cancelacion"></div>
                  <p>Cancelando viaje...</p>
                  <p className="texto-secundario">Esto puede tomar unos segundos</p>
                </div>
              ) : (
                <p>
                  ¿Estás seguro de que quieres cancelar este viaje?
                  <br />
                  Se reembolsará el dinero retenido y se liberarán los asientos.
                </p>
              )}
            </div>
            {!cancelando && (
              <div className="modal-footer-custom modal-footer-dual">
                <button
                  className="btn-secondary-custom"
                  onClick={() => setMostrarModalConfirm(false)}
                >
                  No, mantener viaje
                </button>
                <button
                  className="btn-danger-custom"
                  onClick={async () => {
                    const id = viajeAEliminar;
                    if (id) {
                      await cancelarViaje(id);
                    }
                  }}
                >
                  Sí, cancelar viaje
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}