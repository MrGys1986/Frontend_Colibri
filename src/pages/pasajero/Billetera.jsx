// src/pages/pasajero/Billetera.jsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/pasajero/billetera.css";
import { authClient, AuthClient } from "../../lib/authClient";

const BASE = AuthClient.BASE || "https://c-apigateway.onrender.com";

export default function Billetera() {
  const navigate = useNavigate();

  // === State generales ===
  const [userId, setUserId] = useState("");
  const [saldo, setSaldo] = useState(0);
  const [saldoRetenido, setSaldoRetenido] = useState(0);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);

  // === Modal del sistema (éxito/error) ===
  const [sysModalOpen, setSysModalOpen] = useState(false);
  const [sysModalCfg, setSysModalCfg] = useState({
    title: "",
    message: "",
    kind: "info",
    actions: [],
  });

  // === Modal de Recarga con tarjeta ===
  const [recargaOpen, setRecargaOpen] = useState(false);
  const [montoRecarga, setMontoRecarga] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
  const [cardAddress, setCardAddress] = useState("");

  const fetchJSONWithAuth = async (url, options = {}, { retryOn401 = true } = {}) => {
    const res = await authClient.fetch(url, options, { retryOn401 });
    return res;
  };

  const pesos = (num) => Number(num || 0).toFixed(2);

  const formatCardNumber = (v) =>
    v.replace(/\D/g, "").slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

  const formatExpiry = (v) => {
    const digits = v.replace(/\D/g, "").slice(0, 4);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  };

  const isValidExpiry = (mmYY) => {
    if (!/^\d{2}\/\d{2}$/.test(mmYY)) return false;
    const [mmStr, yyStr] = mmYY.split("/");
    const mm = Number(mmStr);
    if (mm < 1 || mm > 12) return false;
    const now = new Date();
    const yearNow = now.getFullYear() % 100;
    const monthNow = now.getMonth() + 1;
    const yy = Number(yyStr);
    if (yy < yearNow) return false;
    if (yy === yearNow && mm < monthNow) return false;
    return true;
  };

  const openSysModal = (cfg) => {
    setSysModalCfg({
      title: cfg.title || "",
      message: cfg.message || "",
      kind: cfg.kind || "info",
      actions:
        cfg.actions && cfg.actions.length
          ? cfg.actions
          : [{ label: "Cerrar", onClick: () => setSysModalOpen(false) }],
    });
    setSysModalOpen(true);
  };

  useEffect(() => {
    try {
      const rawUser =
        localStorage.getItem("colibri:user") ||
        sessionStorage.getItem("colibri:user");
      if (!rawUser) return;

      const user = JSON.parse(rawUser);
      const uid = user?.id || user?.userId || user?.uid || user?.sub || "";
      setUserId(uid);
    } catch (e) {
      console.error("Error leyendo usuario:", e);
    }
  }, []);

  const cargarCuentaYMovimientos = async () => {
    if (!userId) {
      openSysModal({
        title: "Sesión requerida",
        message: "Inicia sesión para ver tu billetera.",
        kind: "error",
        actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
      });
      return;
    }

    setCargando(true);
    try {
      const rAcc = await fetchJSONWithAuth(
        `${BASE}/api/wallet/accounts/${userId}`,
        { method: "GET" }
      );

      if (rAcc.status === 401) {
        openSysModal({
          title: "Sesión expirada",
          message: "Tu sesión ha expirado. Vuelve a iniciar sesión.",
          kind: "error",
          actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
        });
        return;
      }

      if (!rAcc.ok) throw new Error("Error al leer cuenta");

      const acc = await rAcc.json();
      setSaldo(Number(acc?.balance_cents || 0) / 100);
      setSaldoRetenido(Number(acc?.hold_cents || 0) / 100);

      const rLed = await fetchJSONWithAuth(
        `${BASE}/api/wallet/ledger/${userId}?limit=50`,
        { method: "GET" }
      );

      if (rLed.status === 401) {
        openSysModal({
          title: "Sesión expirada",
          message: "Tu sesión ha expirado. Vuelve a iniciar sesión.",
          kind: "error",
          actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
        });
        return;
      }

      if (!rLed.ok) throw new Error("Error al leer movimientos");

      const led = await rLed.json();
      const adaptados = (led || []).map((row) => {
        const monto = Number(row.amount_cents) / 100;
        const tipoUi =
          row.type === "REFUND"
            ? "recarga"
            : row.type === "HOLD"
            ? "reserva"
            : row.type === "RELEASE"
            ? "liberacion"
            : row.type.toLowerCase();

        const desc =
          row.type === "REFUND"
            ? "Recarga de saldo"
            : row.type === "HOLD"
            ? "Saldo retenido por reserva"
            : row.type === "RELEASE"
            ? "Liberación de saldo"
            : row.type === "CAPTURE"
            ? "Cargo por viaje"
            : row.type;

        const estado = row.type === "HOLD" ? "retenido" : "completado";

        return {
          id: row.id || row._id,
          tipo: tipoUi,
          monto,
          descripcion: desc,
          fecha: new Date(row.created_at || row.timestamp).toLocaleString(),
          estado,
        };
      });
      setMovimientos(adaptados);
    } catch (e) {
      console.error("Error cargando billetera:", e);
      openSysModal({
        title: "No se pudieron cargar los datos",
        message: e.message || "Intenta nuevamente en unos segundos.",
        kind: "error",
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (userId) cargarCuentaYMovimientos();
  }, [userId]);

  const validateCardForm = () => {
    const errors = [];
    const cleanCard = cardNumber.replace(/\s/g, "");
    const amount = Number(montoRecarga);

    if (!amount || amount < 10) errors.push("La recarga mínima es de $10.00 MXN.");
    if (cleanCard.length !== 16) errors.push("La tarjeta debe tener 16 dígitos.");
    if (!isValidExpiry(cardExpiry)) errors.push("Fecha de vencimiento inválida (usa MM/YY).");
    if (!/^\d{3}$/.test(cardCvv)) errors.push("CVV inválido (3 dígitos).");
    if (!cardName.trim()) errors.push("Ingresa el nombre del titular.");

    return errors;
  };

  const handleConfirmarRecarga = async () => {
    const errs = validateCardForm();
    if (errs.length) {
      openSysModal({
        title: "Revisa tu información",
        message: errs.join("\n"),
        kind: "error",
      });
      return;
    }
    if (!userId) {
      openSysModal({
        title: "Sesión inválida",
        message: "Inicia sesión para recargar saldo.",
        kind: "error",
        actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
      });
      return;
    }

    setCargando(true);
    try {
      const amount = Math.round(Number(montoRecarga) * 100);

      const body = {
        operation_id: `topup-${Date.now()}`,
        user_id: userId,
        amount_cents: amount,
        reservation_id: null,
        reason: "topup",
      };

      const r = await fetchJSONWithAuth(`${BASE}/api/wallet/refund`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        if (r.status === 401) {
          openSysModal({
            title: "Sesión expirada",
            message: "Tu sesión ha expirada. Vuelve a iniciar sesión.",
            kind: "error",
            actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
          });
          return;
        }
        const txt = await r.text();
        throw new Error(txt || "No se pudo acreditar la recarga.");
      }

      await cargarCuentaYMovimientos();

      openSysModal({
        title: "¡Pago exitoso!",
        message: `Se acreditaron $${pesos(Number(montoRecarga))} MXN a tu billetera.`,
        kind: "success",
      });

      setMontoRecarga("");
      setCardNumber("");
      setCardName("");
      setCardExpiry("");
      setCardCvv("");
      setCardAddress("");
      setRecargaOpen(false);
    } catch (e) {
      console.error("Error en recarga:", e);
      openSysModal({
        title: "No se pudo completar el pago",
        message: e.message || "Verifica tu conexión o inténtalo más tarde.",
        kind: "error",
      });
    } finally {
      setCargando(false);
    }
  };

  const getIconoTipo = (tipo) => {
    switch (tipo) {
      case "recarga":
        return "💰";
      case "reserva":
        return "🎫";
      case "liberacion":
        return "✅";
      default:
        return "💳";
    }
  };

  const getColorMonto = (_tipo, monto) =>
    monto >= 0 ? "positivo" : "negativo";

  return (
    <div className="billetera">
      {/* ====== Estilos embebidos para modal ====== */}
      <style>{`
        .modal-overlay-top {
          position: fixed; inset: 0; z-index: 9999;
          display: flex; align-items: center; justify-content: center;
          padding: 24px;
          background: rgba(4, 10, 25, 0.65);
          backdrop-filter: blur(2px);
        }
        .modal-card {
          width: 100%; max-width: 520px;
          border-radius: 16px;
          padding: 20px 18px;
          background: linear-gradient(180deg, #0E1730 0%, #0A1226 100%);
          color: #fff; box-shadow: 0 10px 30px rgba(0,0,0,0.4);
          border: 1px solid rgba(46, 150, 245, 0.25);
        }
        .modal-card.success { border-color: rgba(46, 245, 150, 0.35); }
        .modal-card.error   { border-color: rgba(245, 70, 70, 0.35); }
        .modal-title {
          margin: 0 0 10px; font-size: 1.25rem; font-weight: 700;
        }
        .modal-message {
          white-space: pre-wrap;
          margin: 0 0 16px; font-size: .95rem; line-height: 1.5;
          color: #D8E4FF;
        }
        .modal-actions {
          display: flex; gap: 10px; justify-content: flex-end; flex-wrap: wrap;
        }
        .btn {
          border: none; cursor: pointer; border-radius: 10px; padding: 10px 14px;
          font-weight: 700;
        }
        .btn-primary { background: #2E96F5; color: #fff; }
        .btn-primary:hover { filter: brightness(1.05); }
        .btn-success { background: #19C37D; color: #05121F; }
        .btn-danger  { background: #E33C3C; color: #fff; }
        .btn-secondary { background: #0E203C; color: #D8E4FF; border: 1px solid #25456C; }

        /* ===== Modal recarga mejorada para móvil ===== */
        .modal-recarga-overlay {
          position: fixed;
          inset: 0;
          z-index: 9998;
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 16px;
          background: rgba(4, 10, 25, 0.55);
          backdrop-filter: blur(2px);
          overflow-y: auto; /* 🔹 Permite scroll si la tarjeta es muy alta */
        }
        .modal-recarga-card {
          width: 100%;
          max-width: 680px;
          border-radius: 16px;
          padding: 20px;
          background: #0B132B;
          color: #fff;
          border: 1px solid rgba(91,192,190,0.2);
          max-height: calc(100vh - 32px); /* 🔹 No se pasa del alto de pantalla */
          overflow-y: auto;               /* 🔹 Scroll interno en móvil */
        }
        .grid { display: grid; gap: 12px; }
        @media (min-width: 640px) {
          .grid-2 { grid-template-columns: 1fr 1fr; }
        }
        .input-group { display: flex; flex-direction: column; gap: 6px; }
        .input-group label { font-size: .9rem; color: #C8D6FF; }
        .input-group input {
          background: #0E1730; color: #fff; border: 1px solid #2A3C66;
          padding: 10px 12px; border-radius: 10px; outline: none;
        }
        .input-group input::placeholder { color: #8CA2D6; }
        .montos-rapidos {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          margin-top: 6px;
        }
        .montos-rapidos button {
          background: #0E203C; color: #D8E4FF; border: 1px solid #25456C;
          padding: 8px 12px; border-radius: 8px; cursor: pointer;
        }
        .montos-rapidos button:hover { filter: brightness(1.1); }

        /* Responsivo */
        @media (max-width: 480px) {
          .modal-card, .modal-recarga-card { padding: 14px; border-radius: 14px; }
          .modal-title { font-size: 1.05rem; }
        }
      `}</style>

      {/* ===== Modal del sistema (éxito / error) ===== */}
      {sysModalOpen && (
        <div className="modal-overlay-top" role="dialog" aria-modal="true">
          <div className={`modal-card ${sysModalCfg.kind}`}>
            <h3 className="modal-title">
              {sysModalCfg.kind === "success" ? "✅ " : sysModalCfg.kind === "error" ? "⚠️ " : "ℹ️ "}
              {sysModalCfg.title}
            </h3>
            <p className="modal-message">{sysModalCfg.message}</p>
            <div className="modal-actions">
              {sysModalCfg.actions.map((a, i) => (
                <button
                  key={i}
                  className={`btn ${
                    sysModalCfg.kind === "error"
                      ? "btn-danger"
                      : sysModalCfg.kind === "success"
                      ? "btn-success"
                      : "btn-primary"
                  }`}
                  onClick={() => {
                    setSysModalOpen(false);
                    a.onClick && a.onClick();
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===== Modal de recarga (tarjeta) ===== */}
      {recargaOpen && (
        <div className="modal-recarga-overlay" role="dialog" aria-modal="true">
          <div className="modal-recarga-card">
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Recargar saldo con tarjeta</h3>

            <div className="grid grid-2">
              <div className="input-group">
                <label>Monto a Recargar ($)</label>
                <input
                  type="number"
                  value={montoRecarga}
                  onChange={(e) => setMontoRecarga(e.target.value)}
                  placeholder="Ej: 100"
                  min="10"
                  step="10"
                />
              </div>
              <div className="montos-rapidos">
                <button onClick={() => setMontoRecarga("50")}>$50</button>
                <button onClick={() => setMontoRecarga("100")}>$100</button>
                <button onClick={() => setMontoRecarga("200")}>$200</button>
                <button onClick={() => setMontoRecarga("500")}>$500</button>
              </div>
            </div>

            <div className="grid grid-2" style={{ marginTop: 10 }}>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Número de tarjeta</label>
                <input
                  inputMode="numeric"
                  maxLength={19}
                  value={cardNumber}
                  onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                  placeholder="1234 5678 9012 3456"
                />
              </div>
              <div className="input-group">
                <label>Fecha de vencimiento (MM/YY)</label>
                <input
                  inputMode="numeric"
                  maxLength={5}
                  value={cardExpiry}
                  onChange={(e) => setCardExpiry(formatExpiry(e.target.value))}
                  placeholder="MM/YY"
                />
              </div>
              <div className="input-group">
                <label>CVV</label>
                <input
                  inputMode="numeric"
                  maxLength={3}
                  value={cardCvv}
                  onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder="123"
                />
              </div>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Nombre del titular</label>
                <input
                  type="text"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="Como aparece en la tarjeta"
                />
              </div>
              <div className="input-group" style={{ gridColumn: "1 / -1" }}>
                <label>Dirección (opcional)</label>
                <input
                  type="text"
                  value={cardAddress}
                  onChange={(e) => setCardAddress(e.target.value)}
                  placeholder="Calle, número, ciudad"
                />
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 14 }}>
              <button className="btn btn-secondary" onClick={() => setRecargaOpen(false)} disabled={cargando}>
                Cancelar
              </button>
              <button className="btn btn-primary" onClick={handleConfirmarRecarga} disabled={cargando}>
                {cargando ? "Procesando..." : "Pagar y recargar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONTENIDO DE LA PÁGINA ===== */}
      {/* ...todo lo demás igual que ya tenías (saldos, movimientos, info, etc.) */}
      <div className="billetera-header">
        <h1>Mi Billetera</h1>
        <p>Gestiona tus fondos y movimientos</p>
      </div>

      <div className="saldos-container">
        <div className="saldo-card total">
          <div className="saldo-icon">💰</div>
          <div className="saldo-info">
            <h3>Saldo Total</h3>
            <p className="saldo-monto">${pesos(saldo)}</p>
          </div>
        </div>

        <div className="saldo-card retenido">
          <div className="saldo-icon">⏳</div>
          <div className="saldo-info">
            <h3>Saldo Retenido</h3>
            <p className="saldo-monto">${pesos(saldoRetenido)}</p>
          </div>
        </div>

        <div className="saldo-card disponible">
          <div className="saldo-icon">💳</div>
          <div className="saldo-info">
            <h3>Saldo Disponible</h3>
            <p className="saldo-monto">${pesos(Math.max(0, saldo - saldoRetenido))}</p>
          </div>
        </div>
      </div>

      <div className="acciones-billetera">
        <button className="btn-recargar" onClick={() => setRecargaOpen(true)} disabled={cargando}>
          💳 Recargar Saldo
        </button>

        <button className="btn-historial" onClick={cargarCuentaYMovimientos} disabled={cargando}>
          📊 Refrescar Historial
        </button>
      </div>

      <div className="movimientos-section">
        <h3>Movimientos Recientes</h3>
        {cargando && <p style={{ marginBottom: 8 }}>Cargando movimientos...</p>}
        <div className="movimientos-list">
          {movimientos.map((mov) => (
            <div key={mov.id} className="movimiento-card">
              <div className="movimiento-icon">{getIconoTipo(mov.tipo)}</div>

              <div className="movimiento-info">
                <div className="movimiento-descripcion">{mov.descripcion}</div>
                <div className="movimiento-fecha">{mov.fecha}</div>
              </div>

              <div className={`movimiento-monto ${getColorMonto(mov.tipo, mov.monto)}`}>
                {mov.monto > 0 ? "+" : ""}${pesos(mov.monto)}
              </div>

              <div className={`movimiento-estado ${mov.estado}`}>{mov.estado}</div>
            </div>
          ))}

          {!cargando && movimientos.length === 0 && (
            <div className="movimiento-card">
              <div className="movimiento-info">
                <div className="movimiento-descripcion">Sin movimientos</div>
                <div className="movimiento-fecha">—</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="info-billetera">
        <h4>💡 Información Importante</h4>
        <ul>
          <li>El <strong>Saldo Disponible</strong> es lo que puedes usar para nuevas reservas.</li>
          <li>El <strong>Saldo Retenido</strong> se libera automáticamente cuando completas tu viaje.</li>
          <li>Si cancelas un viaje, el saldo retenido se devuelve a tu billetera.</li>
          <li>Recarga con tarjeta de crédito/débito (simulada).</li>
          <li>Todos los movimientos están auditados y son seguros.</li>
        </ul>
      </div>
    </div>
  );
}
