// src/pages/HomePasajero225.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/pasajero/homePasajero.css";
import { authClient } from "../lib/authClient";

const BASE = "https://c-apigateway.onrender.com";
const colores = [
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
];

// ======================
// Helpers
// ======================
const debounce = (fn, ms = 350) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

// Helper para peticiones con token usando authClient
const fetchJSONWithAuth = (url, options = {}, opts = { retryOn401: true }) =>
  authClient.fetch(url, options, opts);

// ======================
// SISTEMA DE PRECIOS (de MapaRutas)
// ======================
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

// ======================
// Helpers para reservas
// ======================
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

// ======================
//
// Helpers geográficos
// ======================
const toLatLng = ([lng, lat]) => [lat, lng];

const deg2rad = (d) => (d * Math.PI) / 180;
const distanceKm = (lat1, lng1, lat2, lng2) => {
  if (
    typeof lat1 !== "number" ||
    typeof lng1 !== "number" ||
    typeof lat2 !== "number" ||
    typeof lng2 !== "number"
  ) {
    return Infinity;
  }
  const R = 6371;
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) *
      Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// ======================
// Reverse geocoding (coords -> nombre)
// ======================
const reverseCache = new Map();

// 🔹 Recorta dirección a algo tipo "Calle X, Colonia Y"
function shortAddressLabel(label, maxParts = 2) {
  if (!label || typeof label !== "string") return label;
  const parts = label
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return label;
  return parts.slice(0, maxParts).join(", ");
}

async function reverseGeocode(coords) {
  if (!Array.isArray(coords) || coords.length < 2) return null;
  const [lng, lat] = coords;
  const key = `${lat},${lng}`;
  if (reverseCache.has(key)) return reverseCache.get(key);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: {
        "User-Agent": "colibri-web/1.0",
        Referer: window.location.origin,
      },
    });
    if (!res.ok) {
      reverseCache.set(key, null);
      return null;
    }
    const data = await res.json();
    const label = data.display_name || null;
    reverseCache.set(key, label);
    return label;
  } catch {
    reverseCache.set(key, null);
    return null;
  }
}

// ======================
// COMPONENTE PRINCIPAL
// ======================
export default function HomePasajero225() {
  const navigate = useNavigate();

  // Estados de búsqueda
  const [origen, setOrigen] = useState("");
  const [destino, setDestino] = useState("");
  const [origenCoord, setOrigenCoord] = useState(null);
  const [destinoCoord, setDestinoCoord] = useState(null);
  const [asientos, setAsientos] = useState(1);

  // Estados de sugerencias
  const [sugOrigen, setSugOrigen] = useState([]);
  const [sugDestino, setSugDestino] = useState([]);
  const [openSugO, setOpenSugO] = useState(false);
  const [openSugD, setOpenSugD] = useState(false);
  const [hiO, setHiO] = useState(-1);
  const [hiD, setHiD] = useState(-1);

  // Estados de rutas y carga
  const [rutas, setRutas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // NUEVO: Estados para precargar ubicaciones de rutas
  const [ubicacionesPrecargadas, setUbicacionesPrecargadas] = useState({
    origenes: [],
    destinos: [],
  });
  const [precargandoUbicaciones, setPrecargandoUbicaciones] = useState(false);

  // ESTADOS PARA MODAL DE RESERVA (de MapaRutas)
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

  const historyRef = useRef({
    origenes: JSON.parse(localStorage.getItem("colibri:hist_origenes") || "[]"),
    destinos: JSON.parse(localStorage.getItem("colibri:hist_destinos") || "[]"),
  });

  // ======================
  // Precargar ubicaciones de rutas disponibles
  // ======================
  useEffect(() => {
    const precargarUbicaciones = async () => {
      setPrecargandoUbicaciones(true);
      try {
        const ahora = new Date().toISOString();
        const res = await fetch(
          `${BASE}/api/routes/search?status=available&after=${encodeURIComponent(
            ahora
          )}`
        );

        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const data = await res.json();
        const rutasFuturas = Array.isArray(data) ? data : data?.items || [];

        const origenesSet = new Map();
        const destinosSet = new Map();
        const paradasSet = new Map();

        for (const ruta of rutasFuturas) {
          // Origen
          if (ruta.origin?.coordinates) {
            const coordsKey = ruta.origin.coordinates.join(",");
            if (!origenesSet.has(coordsKey)) {
              const label = await reverseGeocode(ruta.origin.coordinates);
              if (label) {
                origenesSet.set(coordsKey, {
                  label: shortAddressLabel(label),
                  coordinates: ruta.origin.coordinates,
                });
              }
            }
          }

          // Paradas
          if (Array.isArray(ruta.stops)) {
            for (const stop of ruta.stops) {
              if (stop?.coordinates) {
                const coordsKey = stop.coordinates.join(",");
                if (!paradasSet.has(coordsKey)) {
                  const label = await reverseGeocode(stop.coordinates);
                  if (label) {
                    paradasSet.set(coordsKey, {
                      label: shortAddressLabel(label),
                      coordinates: stop.coordinates,
                    });
                  }
                }
              }
            }
          }

          // Destino
          if (ruta.destination?.coordinates) {
            const coordsKey = ruta.destination.coordinates.join(",");
            if (!destinosSet.has(coordsKey)) {
              const label = await reverseGeocode(ruta.destination.coordinates);
              if (label) {
                destinosSet.set(coordsKey, {
                  label: shortAddressLabel(label),
                  coordinates: ruta.destination.coordinates,
                });
              }
            }
          }
        }

        const origenesCombinados = [
          ...origenesSet.values(),
          ...paradasSet.values(),
        ];
        const destinosCombinados = [
          ...destinosSet.values(),
          ...paradasSet.values(),
        ];

        setUbicacionesPrecargadas({
          origenes: origenesCombinados,
          destinos: destinosCombinados,
        });
      } catch (error) {
        console.error("Error precargando ubicaciones:", error);
      } finally {
        setPrecargandoUbicaciones(false);
      }
    };

    precargarUbicaciones();
  }, []);

  // ======================
  // FUNCIONES MODAL RESERVA
  // ======================
  const openModal = (ruta) => {
    const lastIdx = Math.max(1, (ruta?.points?.length ?? 2) - 1);

    const startIdx =
      typeof ruta._idxO === "number" && ruta._idxO >= 0 ? ruta._idxO : 0;
    const endIdx =
      typeof ruta._idxD === "number" && ruta._idxD > startIdx
        ? ruta._idxD
        : lastIdx;

    setSeleccionada(ruta);
    setSuboEn(startIdx);
    setBajoEn(endIdx);
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

  const puntoLabel = (ruta, idx) => {
    if (!ruta?.points?.length) return `Punto ${idx + 1}`;
    if (idx === 0) return ruta.originLabel || "Inicio";
    if (idx === ruta.points.length - 1)
      return ruta.destinationLabel || "Destino";
    const iStop = idx - 1;
    return (ruta.stopLabels && ruta.stopLabels[iStop]) || `Parada ${iStop + 1}`;
  };

  // ======================
  // CONFIRMAR RESERVA
  // ======================
  const confirmReserva = async () => {
    if (!seleccionada) return;
    const { user } = getStored();
    const passengerId = user?.id || user?.userId || user?.uid || user?.sub;
    if (!passengerId) {
      showToast("error", "No se encontró el usuario autenticado.");
      return;
    }

    if (bajoEn <= suboEn) {
      showToast("error", "Selecciona un tramo válido.");
      return;
    }
    if (seatsWanted < 1) {
      showToast("error", "El mínimo es 1 asiento.");
      return;
    }
    if (seatsWanted > maxSeats) {
      showToast("error", "No hay tantos asientos disponibles.");
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

      const resCreate = await fetchJSONWithAuth(`${BASE}/api/reservations`, {
        method: "POST",
        body: JSON.stringify(createBody),
      });
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

      setSuccessCode(code);
      setSuccessMsg(
        `¡Tu reserva está lista! Comparte este código de 5 dígitos con el conductor para confirmar el abordaje:\n\nCódigo: ${code}`
      );
      setSuccessOpen(true);
    } catch (e) {
      console.error(e);
      showToast("error", e.message || "No se pudo completar la reserva.");
    }
  };

  // ======================
  // BUSCAR RUTAS (modo both/origin/destination)
// ======================
  const fetchRoutes = async ({
    originCoord,
    destinationCoord,
    seats,
    mode = "both", // "both" | "origin" | "destination"
  }) => {
    setLoading(true);
    setErrMsg("");

    try {
      const res = await fetch(`${BASE}/api/routes/search`);
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const list = Array.isArray(data) ? data : data?.items || [];

      const now = new Date();
      const rutasFuturas = list.filter((r) => {
        const scheduleDate = r.schedule ? new Date(r.schedule) : null;
        return scheduleDate && scheduleDate > now;
      });

      const rutasConScore = rutasFuturas.map((r) => {
        const puntos = [];
        if (r.origin?.coordinates) {
          puntos.push({ idx: 0, coords: r.origin.coordinates });
        }
        if (Array.isArray(r.stops)) {
          r.stops.forEach((stop, i) => {
            if (stop?.coordinates) {
              puntos.push({ idx: i + 1, coords: stop.coordinates });
            }
          });
        }
        if (r.destination?.coordinates) {
          puntos.push({
            idx: puntos.length,
            coords: r.destination.coordinates,
          });
        }

        let dO = Infinity;
        let dD = Infinity;
        let idxO = -1;
        let idxD = -1;

        if (originCoord && puntos.length) {
          puntos.forEach((p) => {
            const [lng, lat] = p.coords;
            const d = distanceKm(originCoord.lat, originCoord.lng, lat, lng);
            if (d < dO) {
              dO = d;
              idxO = p.idx;
            }
          });
        }

        if (destinationCoord && puntos.length) {
          puntos.forEach((p) => {
            const [lng, lat] = p.coords;
            const d = distanceKm(destinationCoord.lat, destinationCoord.lng, lat, lng);
            if (d < dD) {
              dD = d;
              idxD = p.idx;
            }
          });
        }

        const availableSeats = r.availableSeats || r.seatsAvailable || 0;
        const status = (r.status || "").toLowerCase();

        return {
          ...r,
          _dO: dO,
          _dD: dD,
          _idxO: idxO,
          _idxD: idxD,
          _score: isFinite(dO) && isFinite(dD) ? dO + dD : dO < Infinity ? dO : dD,
          _availableSeats: availableSeats,
          _status: status,
        };
      });

      const rutasFiltradas = rutasConScore
        .filter((r) => {
          const okSeats = r._availableSeats >= seats;
          const okStatus =
            !r._status ||
            r._status === "available" ||
            r._status === "disponible";

          const okOrigin = isFinite(r._dO) && r._dO <= 3.0;
          const okDest = isFinite(r._dD) && r._dD <= 3.0;

          let okDistance = true;
          let okOrder = true;

          if (mode === "both") {
            okDistance = okOrigin && okDest;
            okOrder =
              typeof r._idxO === "number" &&
              typeof r._idxD === "number" &&
              r._idxO >= 0 &&
              r._idxD > r._idxO;
          } else if (mode === "origin") {
            okDistance = okOrigin;
          } else if (mode === "destination") {
            okDistance = okDest;
          }

          return okSeats && okStatus && okDistance && okOrder;
        })
        .sort((a, b) => a._score - b._score)
        .slice(0, 30);

      const rutasConLabels = await Promise.all(
        rutasFiltradas.map(async (r) => {
          let originLabel = r.originLabel;
          let destinationLabel = r.destinationLabel;
          let stopLabels = r.stopLabels;

          if (!originLabel && r.origin?.coordinates) {
            const full = await reverseGeocode(r.origin.coordinates);
            originLabel = full || "Origen cercano a tu ubicación";
          }
          if (!destinationLabel && r.destination?.coordinates) {
            const full = await reverseGeocode(r.destination.coordinates);
            destinationLabel = full || "Destino cercano a tu ruta";
          }

          if (!stopLabels && Array.isArray(r.stops) && r.stops.length) {
            const labels = await Promise.all(
              r.stops.map((s) =>
                s?.coordinates
                  ? reverseGeocode(s.coordinates)
                  : Promise.resolve(null)
              )
            );
            stopLabels = labels.filter(Boolean);
          }

          const originShort =
            originLabel && !originLabel.startsWith("Origen cercano")
              ? shortAddressLabel(originLabel)
              : originLabel;
          const destShort =
            destinationLabel && !destinationLabel.startsWith("Destino cercano")
              ? shortAddressLabel(destinationLabel)
              : destinationLabel;
          const stopsShort = (stopLabels || []).map((txt) =>
            shortAddressLabel(txt)
          );

          const points = [];
          if (r.origin?.coordinates) points.push(toLatLng(r.origin.coordinates));
          if (Array.isArray(r.stops)) {
            r.stops.forEach((stop) => {
              if (stop?.coordinates) points.push(toLatLng(stop.coordinates));
            });
          }
          if (r.destination?.coordinates)
            points.push(toLatLng(r.destination.coordinates));

          return {
            ...r,
            originLabel: originShort,
            destinationLabel: destShort,
            stopLabels: stopsShort,
            points,
            scheduleDate: r.schedule ? new Date(r.schedule) : null,
            total: totalRuta(r),
            color: colores[Math.floor(Math.random() * colores.length)],
            driverName: r.driverName || "Conductor",
            availableSeats: r._availableSeats || r.availableSeats || 1,
            driverRatingDisplay: r.driverRatingDisplay || null,
          };
        })
      );

      setRutas(rutasConLabels);
    } catch (e) {
      console.error("[HomePasajero225] fetchRoutes -> ERROR:", e);
      setErrMsg("No pudimos obtener rutas. Intenta de nuevo.");
      setRutas([]);
    } finally {
      setLoading(false);
    }
  };

  // ======================
  // SUGERENCIAS MEJORADAS - solo ubicaciones precargadas
  // ======================
  const debouncedSuggest = useMemo(
    () =>
      debounce((kind, text) => {
        const base =
          kind === "o"
            ? ubicacionesPrecargadas.origenes
            : ubicacionesPrecargadas.destinos;

        if (!text || text.trim().length === 0) {
          const slice = base.slice(0, 10);
          if (kind === "o") setSugOrigen(slice);
          else setSugDestino(slice);
          return;
        }

        const lower = text.trim().toLowerCase();
        const filtradas = base
          .filter((u) => u.label.toLowerCase().includes(lower))
          .slice(0, 10);

        if (kind === "o") setSugOrigen(filtradas);
        else setSugDestino(filtradas);
      }, 300),
    [ubicacionesPrecargadas]
  );

  // ======================
  // HANDLERS
  // ======================
  const pushHistory = (key, val) => {
    if (!val) return;
    const k = key === "origen" ? "origenes" : "destinos";
    const arr = historyRef.current[k] || [];
    if (!arr.includes(val)) {
      const next = [val, ...arr].slice(0, 10);
      historyRef.current[k] = next;
      localStorage.setItem(`colibri:hist_${k}`, JSON.stringify(next));
    }
  };

  const onChangeOrigen = (v) => {
    setOrigen(v);
    setOrigenCoord(null);
    setOpenSugO(true);
    setHiO(-1);
    debouncedSuggest("o", v);
  };

  const onChangeDestino = (v) => {
    setDestino(v);
    setDestinoCoord(null);
    setOpenSugD(true);
    setHiD(-1);
    debouncedSuggest("d", v);
  };

  const onSelectOrigen = (s) => {
    setOrigen(s.label);
    setOrigenCoord({ lng: s.coordinates[0], lat: s.coordinates[1] });
    setSugOrigen([]);
    setOpenSugO(false);
    pushHistory("origen", s.label);
  };

  const onSelectDestino = (s) => {
    setDestino(s.label);
    setDestinoCoord({ lng: s.coordinates[0], lat: s.coordinates[1] });
    setSugDestino([]);
    setOpenSugD(false);
    pushHistory("destino", s.label);
  };

  const handleKeyDownOrigen = (e) => {
    if (!openSugO || sugOrigen.length === 0) return;
    if (e.key === "ArrowDown")
      setHiO((h) => Math.min(sugOrigen.length - 1, h + 1));
    else if (e.key === "ArrowUp") setHiO((h) => Math.max(-1, h - 1));
    else if (e.key === "Enter" && sugOrigen[hiO]) onSelectOrigen(sugOrigen[hiO]);
  };

  const handleKeyDownDestino = (e) => {
    if (!openSugD || sugDestino.length === 0) return;
    if (e.key === "ArrowDown")
      setHiD((h) => Math.min(sugDestino.length - 1, h + 1));
    else if (e.key === "ArrowUp") setHiD((h) => Math.max(-1, h - 1));
    else if (e.key === "Enter" && sugDestino[hiD]) onSelectDestino(sugDestino[hiD]);
  };

  const onBuscar = async () => {
    if (!origen.trim() || !destino.trim()) {
      setErrMsg("Escribe una dirección de origen y destino.");
      return;
    }

    let originCoordFinal = origenCoord;
    let destinationCoordFinal = destinoCoord;

    if (!originCoordFinal) {
      const encontrado = ubicacionesPrecargadas.origenes.find(
        (u) => u.label === origen
      );
      if (encontrado) {
        originCoordFinal = {
          lng: encontrado.coordinates[0],
          lat: encontrado.coordinates[1],
        };
        setOrigenCoord(originCoordFinal);
      }
    }

    if (!destinationCoordFinal) {
      const encontrado = ubicacionesPrecargadas.destinos.find(
        (u) => u.label === destino
      );
      if (encontrado) {
        destinationCoordFinal = {
          lng: encontrado.coordinates[0],
          lat: encontrado.coordinates[1],
        };
        setDestinoCoord(destinationCoordFinal);
      }
    }

    try {
      if (!originCoordFinal) {
        const geoO = await geocodeLabel(origen.trim());
        if (geoO) {
          originCoordFinal = {
            lng: geoO.coordinates[0],
            lat: geoO.coordinates[1],
          };
          setOrigenCoord(originCoordFinal);
        }
      }

      if (!destinationCoordFinal) {
        const geoD = await geocodeLabel(destino.trim());
        if (geoD) {
          destinationCoordFinal = {
            lng: geoD.coordinates[0],
            lat: geoD.coordinates[1],
          };
          setDestinoCoord(destinationCoordFinal);
        }
      }
    } catch (e) {
      console.error("[HomePasajero225] geocode error:", e);
    }

    if (!originCoordFinal || !destinationCoordFinal) {
      setErrMsg(
        "No pudimos localizar origen o destino. Intenta escribir una dirección más específica."
      );
      return;
    }

    fetchRoutes({
      originCoord: originCoordFinal,
      destinationCoord: destinationCoordFinal,
      seats: asientos,
      mode: "both",
    });
  };

  // 🔹 Buscar SOLO por punto de inicio (origen)
  const onBuscarInicio = async () => {
    if (!origen.trim()) {
      setErrMsg("Escribe o elige un punto de inicio.");
      return;
    }

    let originCoordFinal = origenCoord;

    if (!originCoordFinal) {
      const encontrado = ubicacionesPrecargadas.origenes.find(
        (u) => u.label === origen
      );
      if (encontrado) {
        originCoordFinal = {
          lng: encontrado.coordinates[0],
          lat: encontrado.coordinates[1],
        };
        setOrigenCoord(originCoordFinal);
      }
    }

    try {
      if (!originCoordFinal) {
        const geoO = await geocodeLabel(origen.trim());
        if (geoO) {
          originCoordFinal = {
            lng: geoO.coordinates[0],
            lat: geoO.coordinates[1],
          };
          setOrigenCoord(originCoordFinal);
        }
      }
    } catch (e) {
      console.error("[HomePasajero225] geocode error (inicio):", e);
    }

    if (!originCoordFinal) {
      setErrMsg("No pudimos localizar el punto de inicio.");
      return;
    }

    fetchRoutes({
      originCoord: originCoordFinal,
      destinationCoord: null,
      seats: asientos,
      mode: "origin",
    });
  };

  // 🔹 Buscar SOLO por punto de final (destino)
  const onBuscarFinal = async () => {
    if (!destino.trim()) {
      setErrMsg("Escribe o elige un punto de destino.");
      return;
    }

    let destinationCoordFinal = destinoCoord;

    if (!destinationCoordFinal) {
      const encontrado = ubicacionesPrecargadas.destinos.find(
        (u) => u.label === destino
      );
      if (encontrado) {
        destinationCoordFinal = {
          lng: encontrado.coordinates[0],
          lat: encontrado.coordinates[1],
        };
        setDestinoCoord(destinationCoordFinal);
      }
    }

    try {
      if (!destinationCoordFinal) {
        const geoD = await geocodeLabel(destino.trim());
        if (geoD) {
          destinationCoordFinal = {
            lng: geoD.coordinates[0],
            lat: geoD.coordinates[1],
          };
          setDestinoCoord(destinationCoordFinal);
        }
      }
    } catch (e) {
      console.error("[HomePasajero225] geocode error (final):", e);
    }

    if (!destinationCoordFinal) {
      setErrMsg("No pudimos localizar el punto de destino.");
      return;
    }

    fetchRoutes({
      originCoord: null,
      destinationCoord: destinationCoordFinal,
      seats: asientos,
      mode: "destination",
    });
  };

  // Geocoding auxiliar (lo dejamos igual por compat)
  async function geocodeLabel(label) {
    try {
      const url = new URL(`${BASE}/api/routes/search`);
      url.searchParams.set("q", label);
      const r = await fetch(url.toString());
      if (r.ok) {
        const data = await r.json();
        const list = Array.isArray(data) ? data : data?.items || [];
        for (const ruta of list) {
          if (ruta.originLabel === label && ruta.origin?.coordinates)
            return { label, coordinates: ruta.origin.coordinates };
          if (ruta.destinationLabel === label && ruta.destination?.coordinates)
            return { label, coordinates: ruta.destination.coordinates };
        }
      }
    } catch {}
    return null;
  }

  return (
    <div className="home-wrapper">
      <div className="home-body">
        <main className="main-content">
          <div className="pasajero-home">
            {/* Estilos para modales */}
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
              
              .modal-backdrop {
                position: fixed; inset: 0; z-index: 9998;
                background: rgba(4,10,25,.6); backdrop-filter: blur(2px);
                display: flex; align-items: center; justify-content: center; padding: 20px;
              }
              .modal-card {
                background: #fff; border-radius: 16px; max-width: 800px; width: 100%;
                max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 30px rgba(0,0,0,.3);
              }
              .modal-header {
                display: flex; justify-content: space-between; align-items: center;
                padding: 20px; border-bottom: 1px solid #e2e8f0;
              }
              .modal-header h2 { margin: 0; font-size: 1.5rem; }
              .modal-close {
                background: none; border: none; font-size: 24px; cursor: pointer;
                color: #64748b; padding: 0; width: 30px; height: 30px;
              }
              .modal-body { padding: 20px; }
              .modal-footer {
                display: flex; justify-content: flex-end; gap: 12px;
                padding: 20px; border-top: 1px solid #e2e8f0;
              }
              .btn-secondary {
                background: #64748b; color: white; border: none; padding: 10px 16px;
                border-radius: 8px; cursor: pointer;
              }
              .btn-primary {
                background: #19C37D; color: white; border: none; padding: 10px 16px;
                border-radius: 8px; cursor: pointer;
              }
              .btn-primary:disabled {
                background: #94a3b8; cursor: not-allowed;
              }
              .route-select {
                width: 100%; padding: 8px 12px; border: 1px solid #d1d5db;
                border-radius: 8px; margin-top: 4px;
              }
              .selector-group { margin-bottom: 16px; }
              .price-calculation {
                background: #f8fafc; padding: 16px; border-radius: 8px; margin-top: 16px;
              }
              .price-breakdown {
                display: flex; justify-content: space-between; align-items: center;
              }
              .final-price { font-weight: bold; color: #19C37D; }
              .toast {
                position: fixed; top: 20px; right: 20px; z-index: 10000;
                padding: 12px 16px; border-radius: 8px; color: white;
                max-width: 300px; word-wrap: break-word;
              }
              .toast-success { background: #10b981; }
              .toast-error { background: #ef4444; }
              .toast-info { background: #3b82f6; }
            `}</style>

            <div className="main-header">
              <h1>¿A dónde vamos hoy?</h1>
              <p>Encuentra y filtra rutas disponibles en tiempo real</p>
            </div>

            <div className="search-section">
              <div className="search-card">
                <h3>Buscar ruta</h3>
                <div className="search-inputs">
                  {/* Origen */}
                  <div className="input-wrapper">
                    <span className="input-icon">📍</span>
                    <input
                      type="text"
                      placeholder="¿Dónde estás?"
                      value={origen}
                      onChange={(e) => onChangeOrigen(e.target.value)}
                      onKeyDown={handleKeyDownOrigen}
                      onFocus={() => {
                        setOpenSugO(true);
                        if (!origen) {
                          setSugOrigen(
                            ubicacionesPrecargadas.origenes.slice(0, 10)
                          );
                        }
                      }}
                      onBlur={() => setTimeout(() => setOpenSugO(false), 120)}
                      className="search-input"
                    />
                    {openSugO && sugOrigen.length > 0 && (
                      <ul className="suggest-list">
                        {precargandoUbicaciones && origen === "" ? (
                          <li className="loading-suggestion">
                            Cargando ubicaciones...
                          </li>
                        ) : (
                          sugOrigen.map((s, i) => (
                            <li
                              key={`o-${i}`}
                              className={i === hiO ? "active" : ""}
                              onMouseEnter={() => setHiO(i)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onSelectOrigen(s);
                              }}
                            >
                              {s.label}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>

                  {/* Destino */}
                  <div className="input-wrapper">
                    <span className="input-icon">🎯</span>
                    <input
                      type="text"
                      placeholder="¿A dónde vas?"
                      value={destino}
                      onChange={(e) => onChangeDestino(e.target.value)}
                      onKeyDown={handleKeyDownDestino}
                      onFocus={() => {
                        setOpenSugD(true);
                        if (!destino) {
                          setSugDestino(
                            ubicacionesPrecargadas.destinos.slice(0, 10)
                          );
                        }
                      }}
                      onBlur={() => setTimeout(() => setOpenSugD(false), 120)}
                      className="search-input"
                    />
                    {openSugD && sugDestino.length > 0 && (
                      <ul className="suggest-list">
                        {precargandoUbicaciones && destino === "" ? (
                          <li className="loading-suggestion">
                            Cargando ubicaciones...
                          </li>
                        ) : (
                          sugDestino.map((s, i) => (
                            <li
                              key={`d-${i}`}
                              className={i === hiD ? "active" : ""}
                              onMouseEnter={() => setHiD(i)}
                              onMouseDown={(e) => {
                                e.preventDefault();
                                onSelectDestino(s);
                              }}
                            >
                              {s.label}
                            </li>
                          ))
                        )}
                      </ul>
                    )}
                  </div>
                </div>

                <div className="filters">
                  <div className="filter-item">
                    <label>Asientos</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={asientos}
                      onChange={(e) =>
                        setAsientos(
                          Math.max(
                            1,
                            Math.min(6, Number(e.target.value) || 1)
                          )
                        )
                      }
                      className="input-number"
                    />
                  </div>

                  <div className="filter-actions">
                    <button className="btn-search" onClick={onBuscar}>
                      🔍 Buscar rutas
                    </button>
                    <button className="btn-search" onClick={onBuscarInicio}>
                      📍 Buscar por inicio
                    </button>
                    <button className="btn-search" onClick={onBuscarFinal}>
                      🎯 Buscar por destino
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {errMsg && (
              <div className="app-alert error" onClick={() => setErrMsg("")}>
                {errMsg}
              </div>
            )}

            <div className="resultados-section">
              {loading ? (
                <div className="cargando">
                  <div className="loading-spinner"></div>
                  Buscando rutas disponibles...
                </div>
              ) : rutas.length === 0 ? (
                <div className="sin-resultados">
                  <h3>No se encontraron rutas</h3>
                  <p>
                    Intenta ajustar los filtros o buscar en diferentes
                    ubicaciones.
                  </p>
                </div>
              ) : (
                <div className="rutas-lista">
                  <div className="lista-header">
                    <h3>Rutas Disponibles ({rutas.length})</h3>
                    <div className="lista-stats">
                      <span className="stat-total">
                        Total: {rutas.length} rutas
                      </span>
                    </div>
                  </div>

                  <div className="rutas-grid">
                    {rutas.map((r, idx) => (
                      <div
                        key={r._id || r.id || idx}
                        className="ruta-card"
                      >
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
                            <span className="driver-name">
                              {r.driverName}
                            </span>
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
                            {/* Origen */}
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
                                <span className="stop-name">
                                  {r.originLabel}
                                </span>
                              </div>
                            </div>

                            {/* Paradas intermedias */}
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

                            {/* Destino */}
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
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Modal de detalles de reserva */}
      {mostrandoModal && seleccionada && (
        <div className="modal-backdrop" onClick={closeModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Detalles de la Ruta</h2>
              <button className="modal-close" onClick={closeModal}>
                ×
              </button>
            </div>

            <div className="modal-body">
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
                        ? seleccionada.scheduleDate.toLocaleString("es-MX", {
                            weekday: "long",
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
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
                        <strong>Inicio:</strong> {seleccionada.originLabel}
                      </div>
                    </div>
                    {seleccionada.stopLabels?.map((stop, idx) => (
                      <div key={idx} className="stop-item intermediate">
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
                          if (i === seleccionada.points.length - 1) return null;
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
                      <small className="hint">Disponibles: {maxSeats}</small>
                    </div>
                  </div>

                  <div className="price-calculation">
                    <div className="price-breakdown">
                      <span>Precio por pasajero:</span>
                      <span className="final-price">
                        ${priceSeleccion.toFixed(2)}
                      </span>
                    </div>
                    <div className="price-breakdown" style={{ marginTop: 8 }}>
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
                  bajoEn <= suboEn ||
                  !seleccionada.availableSeats ||
                  seatsWanted < 1 ||
                  seatsWanted > maxSeats
                }
              >
                {!seleccionada.availableSeats
                  ? "Sin asientos disponibles"
                  : "Confirmar Reserva"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de éxito */}
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
                  if (uid) navigate(`/pasajero/${uid}`, { replace: true });
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
