// src/components/conductor/PerfilConductor.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import "../../styles/perfilConductor.css";

const BASE = "https://c-apigateway.onrender.com";
const MAX_IMAGE_MB = 5; // igual que pasajero

export default function PerfilConductor() {
  const { userId: userIdParam } = useParams();
  const navigate = useNavigate();

  const token = useMemo(
    () => localStorage.getItem("colibri:access_token") || "",
    []
  );
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("colibri:user") || "{}");
    } catch {
      return {};
    }
  }, []);

  const effectiveUserId = userIdParam || storedUser.id;

  const buildHeadersJson = () => ({
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  });

  const buildHeadersAuth = () => ({
    Authorization: `Bearer ${token}`,
  });

  // ====== STATE ======
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editando, setEditando] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showPanicModal, setShowPanicModal] = useState(false);

  const [userData, setUserData] = useState({
    full_name: storedUser.full_name || storedUser.name || "",
    email: storedUser.email || "",
  });

  const [perfil, setPerfil] = useState({
    name: storedUser.full_name || storedUser.name || "",
    email: storedUser.email || "",
    phone_number: "",
    license_number: "",
    plate_number: "",
    vehicle_brand: "",
    vehicle_model: "",
    vehicle_year: "",
    rating_avg: 5,
    status: true,
    id_document_url: "",
  });

  const [formData, setFormData] = useState({ ...perfil });

  // 🔔 Prefs de notificaciones (solo frontend, sin backend)
  const [notifPrefs, setNotifPrefs] = useState({
    notify_new_routes: true,
    notify_route_changes: true,
    notify_payments: true,
  });

  const handleNotifChange = (e) => {
    const { name, checked } = e.target;
    setNotifPrefs((prev) => ({
      ...prev,
      [name]: checked,
    }));
  };

  // ====== Helpers de mapeo ======
  const mapIn = (payload) => {
    const driver = payload.driver || payload;

    return {
      name: userData.full_name || perfil.name || "",
      email: userData.email || perfil.email || "",
      phone_number: driver.phone_number || "",
      license_number: driver.license_number || "",
      plate_number: driver.plate_number || "",
      vehicle_brand: driver.vehicle_brand || "",
      vehicle_model: driver.vehicle_model || "",
      vehicle_year: driver.vehicle_year ?? "",
      rating_avg: Number(driver.rating_avg ?? 5),
      status:
        driver.status !== undefined && driver.status !== null
          ? !!driver.status
          : true,
      id_document_url: driver.id_document_url || "",
    };
  };

  const mapOut = (state) => ({
    phone_number: state.phone_number || null,
    license_number: state.license_number || null,
    plate_number: state.plate_number || null,
    vehicle_brand: state.vehicle_brand || null,
    vehicle_model: state.vehicle_model || null,
    vehicle_year: state.vehicle_year ? Number(state.vehicle_year) : null,
    status: !!state.status,
    id_document_url: state.id_document_url || null,
  });

  // ====== 1) Traer nombre/email desde /auth/user/:id ======
  useEffect(() => {
    if (!token || !effectiveUserId) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    const fetchUser = async () => {
      try {
        const res = await fetch(`${BASE}/auth/user/${effectiveUserId}`, {
          headers: buildHeadersAuth(),
        });

        if (res.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        if (!res.ok) return;

        const json = await res.json();
        if (cancelled) return;

        const full_name =
          json.full_name ||
          json.name ||
          json.nombre ||
          userData.full_name ||
          "";
        const email = json.email || userData.email || "";

        setUserData({ full_name, email });
        setPerfil((prev) => ({
          ...prev,
          name: full_name,
          email,
        }));
        setFormData((prev) => ({
          ...prev,
          name: full_name,
          email,
        }));
      } catch (e) {
        console.error("Error cargando usuario auth:", e);
      }
    };

    fetchUser();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, effectiveUserId]);

  // ====== 2) Traer perfil de driver desde /users/drivers/:id ======
  useEffect(() => {
    if (!token || !effectiveUserId) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    const fetchDriver = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const res = await fetch(
          `${BASE}/users/drivers/${effectiveUserId}`,
          {
            method: "GET",
            headers: buildHeadersJson(),
          }
        );

        if (res.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        // 404 → no hay perfil aún
        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setEditando(true);
            const basePerfil = {
              ...perfil,
              name: userData.full_name || perfil.name || "",
              email: userData.email || perfil.email || "",
            };
            setPerfil(basePerfil);
            setFormData(basePerfil);
          }
          return;
        }

        // Por si el micro regresa 500 con mensaje "driver profile not found"
        if (res.status === 500) {
          const txt = (await res.text().catch(() => "")) || "";
          if (txt.toLowerCase().includes("driver profile not found")) {
            if (!cancelled) {
              setNotFound(true);
              setEditando(true);
              const basePerfil = {
                ...perfil,
                name: userData.full_name || perfil.name || "",
                email: userData.email || perfil.email || "",
              };
              setPerfil(basePerfil);
              setFormData(basePerfil);
            }
            return;
          }
          throw new Error(`Error 500 ${txt}`);
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Error ${res.status} ${txt}`);
        }

        const json = await res.json();
        if (!cancelled) {
          const mapped = mapIn(json);
          setPerfil(mapped);
          setFormData(mapped);
          setNotFound(false);
        }
      } catch (e) {
        if (!cancelled) {
          console.error(e);
          setError("No se pudo cargar tu perfil de conductor.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDriver();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, effectiveUserId, userData.full_name, userData.email]);

  // ====== Handlers de formulario ======
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCancelar = () => {
    setFormData(perfil);
    setEditando(false);
    setError("");
    setSuccess("");
  };

  // ====== Imagen de identificación (solo estado) ======
  const handleIdDocChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado no es una imagen válida.");
      setSuccess("");
      return;
    }

    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > MAX_IMAGE_MB) {
      setError(
        `La imagen es muy pesada (${sizeMB.toFixed(
          2
        )} MB). Máximo permitido: ${MAX_IMAGE_MB} MB.`
      );
      setSuccess("");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      setFormData((prev) => ({
        ...prev,
        id_document_url: url,
      }));
      setSuccess(
        'Documento cargado. Ahora pulsa "Guardar documento" para almacenarlo.'
      );
      setError("");
    };
    reader.readAsDataURL(file);
  };

  // ====== Guardar solo documento ======
  const handleGuardarDocumento = async () => {
    if (!effectiveUserId) return;

    if (notFound) {
      setError(
        "Primero guarda tu perfil de conductor antes de subir tu documento."
      );
      setSuccess("");
      return;
    }

    const urlDoc = formData.id_document_url;
    if (!urlDoc) {
      setError("Primero selecciona una imagen de identificación.");
      setSuccess("");
      return;
    }

    setSavingDoc(true);
    setError("");
    setSuccess("");

    try {
      const body = {
        id_document_url: urlDoc,
      };

      const res = await fetch(`${BASE}/users/drivers/${effectiveUserId}`, {
        method: "PATCH",
        headers: buildHeadersJson(),
        body: JSON.stringify(body),
      });

      if (res.status === 401) {
        navigate("/", { replace: true });
        return;
      }

      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(`Error ${res.status} ${txt}`);
      }

      setPerfil((prev) => ({
        ...prev,
        id_document_url: urlDoc,
      }));
      setFormData((prev) => ({
        ...prev,
        id_document_url: urlDoc,
      }));

      setSuccess("Documento de identificación guardado correctamente.");
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el documento. Intenta nuevamente.");
    } finally {
      setSavingDoc(false);
    }
  };

  // ====== Guardar perfil completo (crear/actualizar) ======
  const handleGuardar = async () => {
    if (!effectiveUserId) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (notFound) {
        // Crear perfil
        const body = {
          user_id: effectiveUserId,
          ...mapOut(formData),
          status: true,
        };

        const res = await fetch(`${BASE}/users/drivers`, {
          method: "POST",
          headers: buildHeadersJson(),
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Error ${res.status} ${txt}`);
        }

        const fresh = await fetch(
          `${BASE}/users/drivers/${effectiveUserId}`,
          { headers: buildHeadersJson() }
        );
        const json = await fresh.json();
        const mapped = mapIn(json);

        setPerfil(mapped);
        setFormData(mapped);
        setNotFound(false);
        setEditando(false);
        setSuccess("Perfil de conductor creado correctamente.");
      } else {
        // Actualizar perfil
        const body = mapOut(formData);

        const res = await fetch(
          `${BASE}/users/drivers/${effectiveUserId}`,
          {
            method: "PATCH",
            headers: buildHeadersJson(),
            body: JSON.stringify(body),
          }
        );

        if (res.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Error ${res.status} ${txt}`);
        }

        setPerfil(formData);
        setEditando(false);
        setSuccess("Perfil actualizado correctamente.");
      }
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el perfil. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  // ====== UI ======
  if (loading) {
    return (
      <div className="perfil-conductor">
        <div className="perfil-header">
          <h1>Perfil de Conductor</h1>
        </div>
        <p>Cargando perfil…</p>
      </div>
    );
  }

  const docUrl = formData.id_document_url || perfil.id_document_url;

  return (
    <div className="perfil-conductor">
      <div className="perfil-header">
        <h1>Perfil de Conductor</h1>
        <p>Gestiona tu información, vehículo e identificación</p>
      </div>

      <div className="perfil-content">
        {/* Información principal */}
        <div className="perfil-section">
          <div className="section-header">
            <h2>Información Personal</h2>
            {!editando && (
              <button
                className="btn-editar"
                onClick={() => {
                  setFormData(perfil);
                  setEditando(true);
                  setError("");
                  setSuccess("");
                }}
              >
                ✏️ Editar Perfil
              </button>
            )}
          </div>

          <div className="perfil-info">
            <div className="info-form">
              {editando ? (
                <>
                  <div className="input-group">
                    <label className="label-readonly">
                      Nombre Completo (no editable)
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      disabled
                      className="input-readonly"
                    />
                    <small style={{ color: "#ff8a80" }}>
                      El nombre se toma de tu cuenta Colibrí.
                    </small>
                  </div>

                  <div className="input-group">
                    <label className="label-readonly">
                      Email (no editable)
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      disabled
                      className="input-readonly"
                    />
                  </div>

                  <div className="input-group">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      name="phone_number"
                      value={formData.phone_number}
                      onChange={handleChange}
                      placeholder="Ej. 4420000000"
                    />
                  </div>

                  <div className="input-group">
                    <label>Número de licencia</label>
                    <input
                      type="text"
                      name="license_number"
                      value={formData.license_number}
                      onChange={handleChange}
                      placeholder="Número de licencia"
                    />
                  </div>

                  <div className="input-group">
                    <label>Placas</label>
                    <input
                      type="text"
                      name="plate_number"
                      value={formData.plate_number}
                      onChange={handleChange}
                      placeholder="ABC-123"
                    />
                  </div>

                  <div className="form-actions">
                    <button
                      className="btn-guardar"
                      onClick={handleGuardar}
                      disabled={saving}
                    >
                      {saving ? "Guardando…" : "💾 Guardar Cambios"}
                    </button>
                    {!notFound && (
                      <button
                        className="btn-cancelar"
                        onClick={handleCancelar}
                        disabled={saving}
                      >
                        ❌ Cancelar
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  <div className="info-item">
                    <label className="label-readonly">Nombre:</label>
                    <span className="readonly-text">
                      {perfil.name || "—"}
                    </span>
                  </div>
                  <div className="info-item">
                    <label className="label-readonly">Email:</label>
                    <span className="readonly-text">
                      {perfil.email || "—"}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Teléfono:</label>
                    <span>{perfil.phone_number || "—"}</span>
                  </div>
                  <div className="info-item">
                    <label>Licencia:</label>
                    <span>{perfil.license_number || "—"}</span>
                  </div>
                  <div className="info-item">
                    <label>Placas:</label>
                    <span>{perfil.plate_number || "—"}</span>
                  </div>
                  <div className="info-item">
                    <label>Estado:</label>
                    <span className="estado-activo">
                      {perfil.status ? "✅ Activo" : "⛔ Inactivo"}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Información del vehículo */}
        <div className="perfil-section">
          <h2>Información del vehículo</h2>
          <div className="perfil-info">
            <div className="info-form">
              <div className="input-group">
                <label>Marca</label>
                {editando ? (
                  <input
                    type="text"
                    name="vehicle_brand"
                    value={formData.vehicle_brand}
                    onChange={handleChange}
                    placeholder="Ej. Nissan"
                  />
                ) : (
                  <span>{perfil.vehicle_brand || "—"}</span>
                )}
              </div>

              <div className="input-group">
                <label>Modelo</label>
                {editando ? (
                  <input
                    type="text"
                    name="vehicle_model"
                    value={formData.vehicle_model}
                    onChange={handleChange}
                    placeholder="Ej. Versa"
                  />
                ) : (
                  <span>{perfil.vehicle_model || "—"}</span>
                )}
              </div>

              <div className="input-group">
                <label>Año</label>
                {editando ? (
                  <input
                    type="number"
                    name="vehicle_year"
                    min="1980"
                    max={new Date().getFullYear() + 1}
                    value={formData.vehicle_year}
                    onChange={handleChange}
                    placeholder="Año"
                  />
                ) : (
                  <span>{perfil.vehicle_year || "—"}</span>
                )}
              </div>

              <div className="input-group">
                <label>Rating promedio</label>
                <span>⭐ {Number(perfil.rating_avg || 5).toFixed(1)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Documento de identificación */}
        <div className="perfil-section">
          <h2>Documento de identificación</h2>
          <p style={{ color: "#ccc", marginBottom: "1rem" }}>
            Sube una foto de tu licencia, INE o documento oficial donde se
            vean claramente tus datos.
          </p>

          <div className="identificacion-card">
            <div className="identificacion-info">
              <div className="identificacion-actions">
                <label
                  className="btn-guardar btn-doc"
                  style={{ cursor: "pointer" }}
                >
                  📎 Subir / Cambiar documento
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleIdDocChange}
                    style={{ display: "none" }}
                  />
                </label>

                <button
                  className="btn-guardar btn-doc"
                  onClick={handleGuardarDocumento}
                  disabled={savingDoc || !docUrl}
                >
                  {savingDoc ? "Guardando…" : "💾 Guardar documento"}
                </button>
              </div>

              {!docUrl && (
                <span
                  style={{
                    color: "#bbb",
                    marginTop: "0.5rem",
                    display: "block",
                  }}
                >
                  Aún no has subido una identificación.
                </span>
              )}
            </div>

            {docUrl && (
              <div className="identificacion-preview">
                <img
                  src={docUrl}
                  alt="Documento de identificación"
                  className="identificacion-img"
                />
              </div>
            )}
          </div>
        </div>

        {/* Preferencias de notificaciones (solo UI) */}
        <div className="perfil-section">
          <h2>Preferencias de notificaciones</h2>
          <div className="preferencias-grid">
            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="notify_new_routes"
                  checked={notifPrefs.notify_new_routes}
                  onChange={handleNotifChange}
                />
                <span className="slider"></span>
              </label>
              <span>Recibir avisos de nuevas rutas y viajes</span>
            </div>

            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="notify_route_changes"
                  checked={notifPrefs.notify_route_changes}
                  onChange={handleNotifChange}
                />
                <span className="slider"></span>
              </label>
              <span>Notificar cambios de horario en mis rutas</span>
            </div>

            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="notify_payments"
                  checked={notifPrefs.notify_payments}
                  onChange={handleNotifChange}
                />
                <span className="slider"></span>
              </label>
              <span>Recordatorios para revisar mis pagos</span>
            </div>
          </div>
        </div>

        {/* ======================
    BOTÓN DE PÁNICO
====================== */}
<div className="perfil-section alerta-peligro">
  <h2>🆘 Botón de Pánico</h2>
  <p className="alerta-texto">
    Si estás en peligro, pulsa este botón para contactar emergencias.
  </p>

  <button
    className="btn-panico"
    onClick={() => setShowPanicModal(true)}
  >
    🚨 Llamar a Emergencias
  </button>
</div>

{showPanicModal && (
  <div
    className="panic-overlay"
    onClick={() => setShowPanicModal(false)}
  >
    <div
      className="panic-modal"
      onClick={(e) => e.stopPropagation()}
    >
      <h3>Confirmar emergencia</h3>
      <p>Se abrirá la llamada al <b>911</b>.</p>

      <div className="panic-actions">
        <button
          className="panic-confirm"
          onClick={() => {
            setShowPanicModal(false);

            // 🔥 Acción actual (WEB)
            window.location.href = "tel:911";

            // 🔥 FUTURO: Acción para Capacitor (cuando sea app)
            /*
            Capacitor.Plugins.CallNumber.call({
              number: "911",
              bypassAppChooser: true
            });
            */
          }}
        >
          Sí, llamar ahora
        </button>

        <button
          className="panic-cancel"
          onClick={() => setShowPanicModal(false)}
        >
          Cancelar
        </button>
      </div>
    </div>
  </div>
)}

        {/* Acciones de cuenta */}
        <div className="perfil-section">
          <h2>Acciones de Cuenta</h2>
          <div className="acciones-cuenta">
            <button
              className="btn-accion"
              onClick={() =>
                window.open(
                  "https://axel-j-aa.github.io/colibri-privacy/TyC.html",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              📋 Ver Términos y Condiciones
            </button>
            <button
              className="btn-accion"
              onClick={() =>
                window.open(
                  "https://axel-j-aa.github.io/colibri-privacy/privacidad.html",
                  "_blank",
                  "noopener,noreferrer"
                )
              }
            >
              🛡️ Política de Privacidad
            </button>
          </div>
        </div>

        {error && <div className="perfil-error">{error}</div>}
        {success && <div className="perfil-success">{success}</div>}
      </div>
    </div>
  );
}
