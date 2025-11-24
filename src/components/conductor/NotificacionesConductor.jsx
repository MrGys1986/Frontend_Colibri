import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/notificacionesConductor.css";

const BASE = "https://c-apigateway.onrender.com";

// Componente de Cargador Personalizado
const CargadorPersonalizado = ({ mensaje = "Procesando..." }) => {
  return (
    <div className="cargador-personalizado-overlay">
      <div className="cargador-personalizado-contenido">
        <div className="cargador-spinner"></div>
        <p className="cargador-mensaje">{mensaje}</p>
      </div>
    </div>
  );
};

// Componente de Modal Personalizado
const ModalPersonalizado = ({
  isOpen,
  onClose,
  title,
  message,
  type = "info",
  actions = [],
}) => {
  if (!isOpen) return null;

  const getIcono = () => {
    switch (type) {
      case "success":
        return "✅";
      case "error":
        return "❌";
      case "warning":
        return "⚠️";
      default:
        return "ℹ️";
    }
  };

  const getColorBorde = () => {
    switch (type) {
      case "success":
        return "#19C37D";
      case "error":
        return "#E33C3C";
      case "warning":
        return "#F4D03F";
      default:
        return "#2E96F5";
    }
  };

  return (
    <div className="modal-personalizado-overlay" onClick={onClose}>
      <div
        className="modal-personalizado-contenido"
        onClick={(e) => e.stopPropagation()}
        style={{ borderColor: getColorBorde() }}
      >
        <div className="modal-personalizado-header">
          <div className="modal-icono-titulo">
            <span className="modal-icono">{getIcono()}</span>
            <h3 className="modal-titulo">{title}</h3>
          </div>
          <button className="modal-cerrar-btn" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="modal-personalizado-body">
          <p className="modal-mensaje">{message}</p>
        </div>

        <div className="modal-personalizado-footer">
          {actions.length > 0 ? (
            actions.map((action, index) => (
              <button
                key={index}
                className={`modal-btn ${action.type || "primary"}`}
                onClick={() => {
                  onClose();
                  action.onClick && action.onClick();
                }}
              >
                {action.label}
              </button>
            ))
          ) : (
            <button className="modal-btn primary" onClick={onClose}>
              Aceptar
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default function BilleteraConductor() {
  const navigate = useNavigate();

  // === State generales ===
  const [userId, setUserId] = useState("");
  const [gananciasDisponibles, setGananciasDisponibles] = useState(0);
  const [movimientos, setMovimientos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [cargandoRetiro, setCargandoRetiro] = useState(false);

  // === Modales personalizados ===
  const [modalAbierto, setModalAbierto] = useState(false);
  const [modalConfig, setModalConfig] = useState({
    title: "",
    message: "",
    type: "info",
    actions: [],
  });

  // === Modal de Retiro de ganancias ===
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [montoRetiro, setMontoRetiro] = useState("");

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
      user = rawUserLS
        ? JSON.parse(rawUserLS)
        : rawUserSS
        ? JSON.parse(rawUserSS)
        : {};
    } catch {}

    const candidatesAccess = [
      rawTokLS,
      rawTokSS,
      user?.token,
      user?.accessToken,
      user?.access_token,
      user?.idToken,
      user?.auth?.accessToken,
      user?.auth?.token,
    ].filter(Boolean);

    const candidatesRefresh = [
      rawRefLS,
      rawRefSS,
      user?.refreshToken,
      user?.refresh_token,
      user?.rt,
      user?.auth?.refreshToken,
    ].filter(Boolean);

    const access = (candidatesAccess[0] || "").trim();
    const refresh = (candidatesRefresh[0] || "").trim();

    return { access, refresh, user };
  };

  const buildAuthHeaders = () => {
    let { access } = getStored();
    const hasBearer = /^Bearer\s+/i.test(access);
    const authValue = access ? (hasBearer ? access : `Bearer ${access}`) : "";
    const h = { "content-type": "application/json" };
    if (authValue) h.authorization = authValue;
    return h;
  };

  // 🔹 Helper fetch con auth (SIN credentials + no-store)
  const fetchJSONWithAuth = async (url, options = {}) => {
    const headers = {
      ...buildAuthHeaders(),
      ...(options.headers || {}),
    };

    const separator = url.includes("?") ? "&" : "?";
    const finalUrl = `${url}${separator}_=${Date.now()}`;

    const res = await fetch(finalUrl, {
      ...options,
      headers,
      // quitamos credentials: 'include' para evitar el problema de CORS con '*'
      cache: "no-store",
    });

    return res;
  };

  // Helpers
  const pesos = (num) => Number(num || 0).toFixed(2);

  const abrirModal = (config) => {
    setModalConfig(config);
    setModalAbierto(true);
  };

  // === Cargar userId al montar ===
  useEffect(() => {
    const { user } = getStored();
    const uid = user?.id || user?.userId || user?.uid || user?.sub || "";
    setUserId(uid);
  }, []);

  const cargarCuentaYMovimientos = async () => {
    if (!userId) {
      abrirModal({
        title: "Sesión requerida",
        message: "Inicia sesión para ver tus ganancias.",
        type: "error",
        actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
      });
      return;
    }

    setCargando(true);
    try {
      // ===== Cuenta (ganancias del conductor) =====
      const rAcc = await fetchJSONWithAuth(
        `${BASE}/api/wallet/accounts/${userId}`,
        { method: "GET" }
      );

      if (rAcc.status === 401) {
        abrirModal({
          title: "Sesión expirada",
          message: "Tu sesión ha expirado. Vuelve a iniciar sesión.",
          type: "error",
          actions: [{ label: "Ir a Login", onClick: () => navigate("/") }],
        });
        return;
      }

      if (!rAcc.ok) throw new Error("Error al leer cuenta de ganancias");

      const acc = await rAcc.json();
      const total = Number(acc?.balance_cents || 0) / 100;

      setGananciasDisponibles(total);

      // ===== Movimientos (ledger del conductor) =====
      const rLed = await fetchJSONWithAuth(
        `${BASE}/api/wallet/ledger/${userId}?limit=50`,
        { method: "GET" }
      );

      if (!rLed.ok) throw new Error("Error al leer movimientos de ganancias");

      const led = await rLed.json();
      const adaptados = (led || []).map((row) => {
        const monto = Number(row.amount_cents) / 100;

        const tipoUi =
          row.type === "TRIP_EARNINGS" ||
          row.type === "CAPTURE" ||
          row.type === "TRANSFER_IN"
            ? "ganancia"
            : row.type === "WITHDRAW"
            ? "retiro"
            : row.type.toLowerCase();

        const desc =
          row.type === "TRIP_EARNINGS" || row.type === "CAPTURE"
            ? "Ganancia por viaje"
            : row.type === "WITHDRAW"
            ? "Retiro de ganancias"
            : row.type === "TRANSFER_IN"
            ? "Transferencia de viaje"
            : row.type;

        return {
          id: row.id || row._id,
          tipo: tipoUi,
          monto,
          descripcion: desc,
          fecha: new Date(
            row.created_at || row.timestamp
          ).toLocaleString(),
          estado: "completado",
          metadata: row.metadata || {},
        };
      });

      setMovimientos(adaptados);
    } catch (e) {
      console.error("Error cargando billetera conductor:", e);
      abrirModal({
        title: "No se pudieron cargar los datos",
        message: e.message || "Intenta nuevamente en unos segundos.",
        type: "error",
      });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    if (userId) cargarCuentaYMovimientos();
  }, [userId]);

  // === Lógica de retiro de ganancias ===
  const handleConfirmarRetiro = async () => {
    if (!userId) {
      abrirModal({
        title: "Sesión inválida",
        message: "Inicia sesión para retirar tus ganancias.",
        type: "error",
      });
      return;
    }

    const amount = Number(montoRetiro || 0);

    const errores = [];
    if (!amount || amount <= 0) errores.push("Ingresa un monto válido.");
    if (amount < 50) errores.push("El retiro mínimo es de $50.00 MXN.");
    if (amount > gananciasDisponibles)
      errores.push(
        `No puedes retirar más de tus ganancias disponibles ($${pesos(
          gananciasDisponibles
        )} MXN).`
      );

    if (errores.length) {
      abrirModal({
        title: "Revisa el monto del retiro",
        message: errores.join("\n"),
        type: "error",
      });
      return;
    }

    setCargandoRetiro(true);
    try {
      const amountCents = Math.round(amount * 100);
      const operationId = `withdraw-${userId}-${Date.now()}`;

      const body = {
        operation_id: operationId,
        user_id: userId,
        amount_cents: amountCents,
        reason: "Retiro de ganancias conductor",
      };

      const r = await fetchJSONWithAuth(`${BASE}/api/wallet/withdraw`, {
        method: "POST",
        body: JSON.stringify(body),
      });

      if (!r.ok) {
        const errorData = await r.json().catch(() => ({}));
        throw new Error(
          errorData.message ||
            `Error ${r.status}: No se pudo procesar el retiro`
        );
      }

      const result = await r.json();
      console.log("✅ Retiro exitoso:", result);

      // Recargar datos actualizados
      await cargarCuentaYMovimientos();

      abrirModal({
        title: "¡Retiro exitoso!",
        message: `Se ha procesado tu retiro por $${pesos(
          amount
        )} MXN.\n\nTu nuevo saldo disponible es: $${pesos(
          (Number(result.new_balance) || 0) / 100
        )} MXN.`,
        type: "success",
      });

      setMontoRetiro("");
      setWithdrawOpen(false);
    } catch (e) {
      console.error("Error en retiro:", e);
      abrirModal({
        title: "No se pudo completar el retiro",
        message: e.message || "Verifica tu conexión o inténtalo más tarde.",
        type: "error",
      });
    } finally {
      setCargandoRetiro(false);
    }
  };

  const getIconoTipo = (tipo) => {
    switch (tipo) {
      case "ganancia":
        return "💸";
      case "retiro":
        return "🏦";
      default:
        return "📄";
    }
  };

  const getColorMonto = (tipo, monto) => {
    if (tipo === "retiro") return "negative";
    return monto >= 0 ? "positive" : "negative";
  };

  return (
    <div className="driver-wallet">
      {/* Cargador personalizado para retiro */}
      {cargandoRetiro && (
        <CargadorPersonalizado mensaje="Procesando tu retiro..." />
      )}

      {/* Modal personalizado del sistema */}
      <ModalPersonalizado
        isOpen={modalAbierto}
        onClose={() => setModalAbierto(false)}
        title={modalConfig.title}
        message={modalConfig.message}
        type={modalConfig.type}
        actions={modalConfig.actions}
      />

      {/* ===== Modal de retiro ===== */}
      {withdrawOpen && (
        <div
          className="modal-personalizado-overlay"
          onClick={() => !cargandoRetiro && setWithdrawOpen(false)}
        >
          <div
            className="modal-retiro-contenido"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-personalizado-header">
              <div className="modal-icono-titulo">
                <span className="modal-icono">🏦</span>
                <h3 className="modal-titulo">Retirar ganancias</h3>
              </div>
              <button
                className="modal-cerrar-btn"
                onClick={() => setWithdrawOpen(false)}
                disabled={cargandoRetiro}
              >
                ×
              </button>
            </div>

            <div className="modal-personalizado-body">
              <div className="retiro-input-group">
                <label>Monto a retirar ($)</label>
                <input
                  type="number"
                  min="50"
                  step="1"
                  value={montoRetiro}
                  onChange={(e) => setMontoRetiro(e.target.value)}
                  placeholder="Ej: 250"
                  disabled={cargandoRetiro}
                />
                <div className="retiro-hint">
                  Disponible para retirar:{" "}
                  <strong>${pesos(gananciasDisponibles)} MXN</strong>
                  <br />
                  <em>Mínimo: $50.00 MXN</em>
                </div>
              </div>
            </div>

            <div className="modal-personalizado-footer">
              <button
                className="modal-btn secondary"
                onClick={() => setWithdrawOpen(false)}
                disabled={cargandoRetiro}
              >
                Cancelar
              </button>
              <button
                className="modal-btn primary"
                onClick={handleConfirmarRetiro}
                disabled={cargandoRetiro}
              >
                {cargandoRetiro ? (
                  <>
                    <span className="btn-spinner"></span>
                    Procesando...
                  </>
                ) : (
                  "Confirmar retiro"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== CONTENIDO DE LA PÁGINA ===== */}
      <div className="driver-wallet-header">
        <h1>Mis Ganancias</h1>
        <p>Consulta tus ganancias y retira el dinero disponible</p>
      </div>

      {/* Cargador general */}
      {cargando && (
        <CargadorPersonalizado mensaje="Cargando tus ganancias..." />
      )}

      {/* SOLO GANANCIAS DISPONIBLES */}
      <div className="driver-wallet-balances">
        <div className="driver-balance-card available">
          <div className="driver-balance-icon">💰</div>
          <div className="driver-balance-info">
            <h3>Ganancias Disponibles</h3>
            <p className="driver-balance-amount">
              ${pesos(gananciasDisponibles)}
            </p>
          </div>
        </div>
      </div>

      {/* Acciones rápidas */}
      <div className="driver-wallet-actions">
        <button
          className="driver-btn-withdraw"
          onClick={() => setWithdrawOpen(true)}
          disabled={cargando || gananciasDisponibles < 50}
        >
          🏦 Retirar ganancias
        </button>

        <button
          className="driver-btn-refresh"
          onClick={cargarCuentaYMovimientos}
          disabled={cargando}
        >
          🔄 Refrescar datos
        </button>
      </div>

      {/* Movimientos recientes */}
      <div className="driver-movements-section">
        <h3>Movimientos recientes</h3>
        {cargando && <p style={{ marginBottom: 8 }}>Cargando movimientos...</p>}
        <div className="driver-movements-list">
          {movimientos.map((mov) => (
            <div key={mov.id} className="driver-movement-card">
              <div className="driver-movement-icon">
                {getIconoTipo(mov.tipo)}
              </div>

              <div className="driver-movement-info">
                <div className="driver-movement-description">
                  {mov.descripcion}
                </div>
                <div className="driver-movement-date">{mov.fecha}</div>
              </div>

              <div
                className={`driver-movement-amount ${getColorMonto(
                  mov.tipo,
                  mov.monto
                )}`}
              >
                {mov.monto > 0 ? "+" : ""}
                ${pesos(mov.monto)}
              </div>

              <div className={`driver-movement-status ${mov.estado}`}>
                {mov.estado}
              </div>
            </div>
          ))}

          {!cargando && movimientos.length === 0 && (
            <div className="driver-movement-card">
              <div className="driver-movement-info">
                <div className="driver-movement-description">
                  Sin movimientos registrados
                </div>
                <div className="driver-movement-date">—</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Información importante */}
      <div className="driver-wallet-info">
        <h4>💡 Información importante</h4>
        <ul>
          <li>
            <strong>Todas tus ganancias están disponibles</strong> para retiro
            inmediato.
          </li>
          <li>
            <strong>Retiro mínimo:</strong> $50.00 MXN por transacción.
          </li>
          <li>
            Cada retiro se procesa inmediatamente y se refleja en tu historial.
          </li>
          <li>
            Los retiros pueden tardar de 1 a 3 días hábiles en reflejarse en tu
            cuenta bancaria.
          </li>
          <li>
            Tus ganancias se actualizan automáticamente después de cada viaje
            completado.
          </li>
        </ul>
      </div>

      {/* Estilos embebidos para componentes personalizados */}
      <style jsx>{`
        /* (dejo tus estilos tal cual estaban) */
        .cargador-personalizado-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(4, 10, 25, 0.8);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
        }

        .cargador-personalizado-contenido {
          background: #0b132b;
          border: 1px solid #5bc0be;
          border-radius: 12px;
          padding: 2rem;
          text-align: center;
          color: white;
          min-width: 200px;
        }

        .cargador-spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(91, 192, 190, 0.3);
          border-top: 3px solid #5bc0be;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin: 0 auto 1rem;
        }

        .cargador-mensaje {
          margin: 0;
          color: #cccccc;
        }

        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        .modal-personalizado-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(4, 10, 25, 0.7);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        .modal-personalizado-contenido {
          background: linear-gradient(180deg, #0e1730 0%, #0a1226 100%);
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 500px;
          width: 100%;
          color: white;
          border: 2px solid;
        }

        .modal-retiro-contenido {
          background: #0b132b;
          border-radius: 12px;
          padding: 1.5rem;
          max-width: 450px;
          width: 100%;
          color: white;
          border: 1px solid #5bc0be;
        }

        .modal-personalizado-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1rem;
        }

        .modal-icono-titulo {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .modal-icono {
          font-size: 1.5rem;
        }

        .modal-titulo {
          margin: 0;
          font-size: 1.25rem;
          color: white;
        }

        .modal-cerrar-btn {
          background: none;
          border: none;
          color: #cccccc;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.25rem;
          border-radius: 4px;
        }

        .modal-cerrar-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.1);
        }

        .modal-cerrar-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .modal-personalizado-body {
          margin-bottom: 1.5rem;
        }

        .modal-mensaje {
          margin: 0;
          line-height: 1.5;
          color: #cccccc;
          white-space: pre-wrap;
        }

        .modal-personalizado-footer {
          display: flex;
          gap: 0.75rem;
          justify-content: flex-end;
        }

        .modal-btn {
          padding: 0.75rem 1.5rem;
          border: none;
          border-radius: 8px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 100px;
        }

        .modal-btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .modal-btn.primary {
          background: #5bc0be;
          color: #0b132b;
        }

        .modal-btn.primary:hover:not(:disabled) {
          background: #4aa8a6;
        }

        .modal-btn.secondary {
          background: rgba(255, 255, 255, 0.1);
          color: white;
          border: 1px solid rgba(255, 255, 255, 0.2);
        }

        .modal-btn.secondary:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.2);
        }

        .btn-spinner {
          display: inline-block;
          width: 1rem;
          height: 1rem;
          border: 2px solid transparent;
          border-top: 2px solid currentColor;
          border-radius: 50%;
          animation: spin 1s linear infinite;
          margin-right: 0.5rem;
        }

        .retiro-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .retiro-input-group label {
          font-weight: 600;
          color: #cccccc;
        }

        .retiro-input-group input {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          border-radius: 8px;
          padding: 0.75rem;
          color: white;
          font-size: 1.1rem;
        }

        .retiro-input-group input:disabled {
          opacity: 0.6;
        }

        .retiro-input-group input::placeholder {
          color: rgba(255, 255, 255, 0.5);
        }

        .retiro-hint {
          font-size: 0.875rem;
          color: #999999;
          margin-top: 0.25rem;
        }
      `}</style>
    </div>
  );
}
