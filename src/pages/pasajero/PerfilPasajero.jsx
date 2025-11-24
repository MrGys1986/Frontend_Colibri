// src/pages/pasajero/PerfilPasajero.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "../../styles/pasajero/perfilPasajero.css";

const BASE = "https://c-apigateway.onrender.com";

// 🔹 Límite de imagen en MB (seguro para tu caso)
const MAX_IMAGE_MB = 5;

export default function PerfilPasajero() {
  const { userId: userIdParam } = useParams();
  const navigate = useNavigate();

  // ==== Auth y usuario guardado ====
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

  // ==== State ====
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingDoc, setSavingDoc] = useState(false); // flujo propio del documento
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [editando, setEditando] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [userData, setUserData] = useState({
    full_name: storedUser.full_name || storedUser.name || "",
    email: storedUser.email || "",
  });

  const [perfil, setPerfil] = useState({
    nombre: storedUser.full_name || storedUser.name || "",
    email: storedUser.email || "",
    telefono: "",
    default_country: "",
    default_city: "",
    default_address: "",
    status: true,
    preferences: {
      notify_new_routes: true,
      show_full_name_to_drivers: true,
      share_live_location: false,
      trip_reminders: true,
      id_document_url: "",
    },
  });

  const [formData, setFormData] = useState({ ...perfil });

  const estadisticas = {
    viajesCompletados: 12,
    ratingPromedio: 4.8,
    miembroDesde: "Ene 2024",
    viajesCancelados: 1,
  };

  // ==== Helpers de mapeo con backend ====
  const mapIn = (payload) => {
    const customer = payload.customer || payload;

    // preferences viene como TEXT, así que puede ser string o ya objeto
    let rawPrefs = customer.preferences;
    let prefs = {};

    if (typeof rawPrefs === "string") {
      try {
        prefs = JSON.parse(rawPrefs) || {};
      } catch {
        prefs = {};
      }
    } else if (rawPrefs && typeof rawPrefs === "object") {
      prefs = rawPrefs;
    } else {
      prefs = {};
    }

    return {
      // nombre y email SIEMPRE vienen del servicio de auth
      nombre: userData.full_name || perfil.nombre || "",
      email: userData.email || perfil.email || "",
      telefono: customer.phone_number || "",
      default_country: customer.default_country || "",
      default_city: customer.default_city || "",
      default_address: customer.default_address || "",
      status:
        customer.status !== undefined && customer.status !== null
          ? !!customer.status
          : true,
      preferences: {
        notify_new_routes:
          prefs.notify_new_routes !== undefined
            ? !!prefs.notify_new_routes
            : true,
        show_full_name_to_drivers:
          prefs.show_full_name_to_drivers !== undefined
            ? !!prefs.show_full_name_to_drivers
            : true,
        share_live_location:
          prefs.share_live_location !== undefined
            ? !!prefs.share_live_location
            : false,
        trip_reminders:
          prefs.trip_reminders !== undefined ? !!prefs.trip_reminders : true,
        id_document_url: prefs.id_document_url || "",
      },
    };
  };

  const mapOut = (state) => {
    const prefs = state.preferences || {};

    const outPrefs = {
      notify_new_routes: !!prefs.notify_new_routes,
      show_full_name_to_drivers: !!prefs.show_full_name_to_drivers,
      share_live_location: !!prefs.share_live_location,
      trip_reminders: !!prefs.trip_reminders,
      ...(prefs.id_document_url
        ? { id_document_url: prefs.id_document_url }
        : {}),
    };

    return {
      phone_number: state.telefono || null,
      default_country: state.default_country || null,
      default_city: state.default_city || null,
      default_address: state.default_address || null,
      preferences: JSON.stringify(outPrefs), // TEXT en BD
      status: !!state.status,
    };
  };

  // ==== Cargar datos del usuario desde /auth/user/:id ====
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
          json.full_name || json.name || json.nombre || userData.full_name || "";
        const email = json.email || userData.email || "";

        setUserData({ full_name, email });
        setPerfil((prev) => ({
          ...prev,
          nombre: full_name,
          email,
        }));
        setFormData((prev) => ({
          ...prev,
          nombre: full_name,
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

  // ==== Cargar perfil de customer ====
  useEffect(() => {
    if (!token || !effectiveUserId) {
      navigate("/", { replace: true });
      return;
    }

    let cancelled = false;

    const fetchCustomer = async () => {
      setLoading(true);
      setError("");
      setSuccess("");
      try {
        const res = await fetch(`${BASE}/users/customers/${effectiveUserId}`, {
          method: "GET",
          headers: buildHeadersJson(),
        });

        if (res.status === 401) {
          navigate("/", { replace: true });
          return;
        }

        // 404 => no hay perfil todavía
        if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true);
            setEditando(true);
            const basePerfil = {
              ...perfil,
              nombre: userData.full_name || perfil.nombre || "",
              email: userData.email || perfil.email || "",
            };
            setPerfil(basePerfil);
            setFormData(basePerfil);
          }
          return;
        }

        // por si el micro devuelve 500 "customer profile not found"
        if (res.status === 500) {
          const txt = (await res.text().catch(() => "")) || "";
          if (txt.toLowerCase().includes("customer profile not found")) {
            if (!cancelled) {
              setNotFound(true);
              setEditando(true);
              const basePerfil = {
                ...perfil,
                nombre: userData.full_name || perfil.nombre || "",
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
          setError("No se pudo cargar tu perfil de pasajero.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchCustomer();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, effectiveUserId, userData.full_name, userData.email]);

  // ==== Handlers de formulario ====
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => {
      // Preferencias (switches)
      if (name.startsWith("pref_")) {
        const key = name.replace("pref_", "");
        return {
          ...prev,
          preferences: {
            ...prev.preferences,
            [key]: type === "checkbox" ? checked : value,
          },
        };
      }

      // Campos normales
      return {
        ...prev,
        [name]: value,
      };
    });
  };

  // solo carga la imagen en el estado; el guardado real se hace con handleGuardarDocumento
  const handleIdDocChange = (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    // ✅ Validar que sea imagen
    if (!file.type.startsWith("image/")) {
      setError("El archivo seleccionado no es una imagen válida.");
      setSuccess("");
      return;
    }

    // ✅ Tamaño en MB
    const sizeMB = file.size / (1024 * 1024);

    // ✅ Validar tamaño máx (5 MB por defecto)
    if (sizeMB > MAX_IMAGE_MB) {
      setError(
        `La imagen es muy pesada (${sizeMB.toFixed(
          2
        )} MB). Máximo permitido: ${MAX_IMAGE_MB} MB.`
      );
      setSuccess("");
      return;
    }

    // ✅ Si pasa validaciones, la cargamos en el estado
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result;
      setFormData((prev) => ({
        ...prev,
        preferences: {
          ...prev.preferences,
          id_document_url: url,
        },
      }));
      setSuccess(
        'Documento cargado. Ahora pulsa "Guardar documento" para almacenarlo.'
      );
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleCancelar = () => {
    setFormData(perfil);
    setEditando(false);
    setError("");
    setSuccess("");
  };

  // ==== Guardar documento solo (flujo independiente) ====
  const handleGuardarDocumento = async () => {
    if (!effectiveUserId) return;

    // Si aún no hay perfil creado, no podemos guardar solo el doc
    if (notFound) {
      setError(
        "Primero guarda tu perfil de pasajero (teléfono, dirección, etc.) antes de subir tu documento."
      );
      setSuccess("");
      return;
    }

    const urlDoc = formData.preferences?.id_document_url;
    if (!urlDoc) {
      setError("Primero selecciona una imagen de identificación.");
      setSuccess("");
      return;
    }

    setSavingDoc(true);
    setError("");
    setSuccess("");

    try {
      // Mezclamos las prefs actuales del perfil con la nueva URL
      const prefsPerfil = perfil.preferences || {};
      const mergedPrefs = {
        ...prefsPerfil,
        id_document_url: urlDoc,
      };

      const body = {
        preferences: JSON.stringify(mergedPrefs),
      };

      const res = await fetch(`${BASE}/users/customers/${effectiveUserId}`, {
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

      // Actualizamos perfil y formData en memoria
      setPerfil((prev) => ({
        ...prev,
        preferences: mergedPrefs,
      }));
      setFormData((prev) => ({
        ...prev,
        preferences: mergedPrefs,
      }));

      setSuccess("Documento de identificación guardado correctamente.");
    } catch (e) {
      console.error(e);
      setError("No se pudo guardar el documento. Intenta nuevamente.");
    } finally {
      setSavingDoc(false);
    }
  };

  // ==== Guardar (crea o actualiza perfil completo) ====
  const handleGuardar = async () => {
    if (!effectiveUserId) return;
    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (notFound) {
        // Crear perfil nuevo
        const body = {
          user_id: effectiveUserId,
          ...mapOut(formData),
          status: true,
        };

        const res = await fetch(`${BASE}/users/customers`, {
          method: "POST",
          headers: buildHeadersJson(),
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          const txt = await res.text().catch(() => "");
          throw new Error(`Error ${res.status} ${txt}`);
        }

        // refrescar desde backend
        const fresh = await fetch(
          `${BASE}/users/customers/${effectiveUserId}`,
          { headers: buildHeadersJson() }
        );
        const json = await fresh.json();
        const mapped = mapIn(json);
        setPerfil(mapped);
        setFormData(mapped);
        setNotFound(false);
        setEditando(false);
        setSuccess("Perfil creado correctamente.");
      } else {
        // Actualizar perfil existente
        const body = mapOut(formData);

        const res = await fetch(
          `${BASE}/users/customers/${effectiveUserId}`,
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

  // ==== UI ====
  if (loading) {
    return (
      <div className="perfil-pasajero">
        <div className="perfil-header">
          <h1>Mi Perfil</h1>
        </div>
        <p>Cargando perfil…</p>
      </div>
    );
  }

  const prefs = formData.preferences || {};

  return (
    <div className="perfil-pasajero">
      <div className="perfil-header">
        <h1>Mi Perfil</h1>
        <p>Gestiona tu información personal y preferencias</p>
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
                      name="nombre"
                      value={formData.nombre}
                      onChange={handleInputChange}
                      disabled
                      className="input-readonly"
                    />
                    <small style={{ color: "#ff8a80" }}>
                      Este dato se toma de tu cuenta Colibrí y no se puede editar
                      aquí.
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
                      onChange={handleInputChange}
                      disabled
                      className="input-readonly"
                    />
                  </div>

                  <div className="input-group">
                    <label>Teléfono</label>
                    <input
                      type="tel"
                      name="telefono"
                      value={formData.telefono}
                      onChange={handleInputChange}
                      placeholder="Ej. 4420000000"
                    />
                  </div>

                  <div className="input-group">
                    <label>País</label>
                    <input
                      type="text"
                      name="default_country"
                      value={formData.default_country}
                      onChange={handleInputChange}
                      placeholder="Ej. México"
                    />
                  </div>

                  <div className="input-group">
                    <label>Ciudad</label>
                    <input
                      type="text"
                      name="default_city"
                      value={formData.default_city}
                      onChange={handleInputChange}
                      placeholder="Ej. Querétaro"
                    />
                  </div>

                  <div className="input-group">
                    <label>Dirección</label>
                    <input
                      type="text"
                      name="default_address"
                      value={formData.default_address}
                      onChange={handleInputChange}
                      placeholder="Dirección principal"
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
                      {perfil.nombre || "—"}
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
                    <span>{perfil.telefono || "—"}</span>
                  </div>
                  <div className="info-item">
                    <label>País:</label>
                    <span>{perfil.default_country || "—"}</span>
                  </div>
                  <div className="info-item">
                    <label>Ciudad:</label>
                    <span>{perfil.default_city || "—"}</span>
                  </div>
                  <div className="info-item">
                    <label>Dirección:</label>
                    <span>{perfil.default_address || "—"}</span>
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

        {/* Documento de identificación */}
        <div className="perfil-section">
          <h2>Documento de identificación</h2>
          <p style={{ color: "#ccc", marginBottom: "1rem" }}>
            Sube una foto de tu INE, pasaporte o identificación oficial donde se
            vean claramente tu rostro y tus datos básicos.
          </p>
          <div className="identificacion-card">
            <div className="identificacion-info">
              <div className="identificacion-actions">
                <label className="btn-guardar btn-doc" style={{ cursor: "pointer" }}>
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
                  disabled={savingDoc || !prefs.id_document_url}
                >
                  {savingDoc ? "Guardando…" : "💾 Guardar documento"}
                </button>
              </div>

              {!prefs.id_document_url && (
                <span
                  style={{ color: "#bbb", marginTop: "0.5rem", display: "block" }}
                >
                  Aún no has subido una identificación.
                </span>
              )}
            </div>

            {prefs.id_document_url && (
              <div className="identificacion-preview">
                <img
                  src={prefs.id_document_url}
                  alt="Documento de identificación"
                  className="identificacion-img"
                />
              </div>
            )}
          </div>
        </div>

        {/* Mis Estadísticas */}
        <div className="perfil-section">
          <h2>Mis Estadísticas</h2>
          <div className="estadisticas-grid">
            <div className="estadistica-card">
              <div className="estadistica-icon">🚗</div>
              <div className="estadistica-info">
                <h3>Viajes Completados</h3>
                <p>{estadisticas.viajesCompletados}</p>
              </div>
            </div>

            <div className="estadistica-card">
              <div className="estadistica-icon">⭐</div>
              <div className="estadistica-info">
                <h3>Rating Promedio</h3>
                <p>{estadisticas.ratingPromedio}</p>
              </div>
            </div>

            <div className="estadistica-card">
              <div className="estadistica-icon">📅</div>
              <div className="estadistica-info">
                <h3>Miembro Desde</h3>
                <p>{estadisticas.miembroDesde}</p>
              </div>
            </div>

            <div className="estadistica-card">
              <div className="estadistica-icon">⏹️</div>
              <div className="estadistica-info">
                <h3>Viajes Cancelados</h3>
                <p>{estadisticas.viajesCancelados}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preferencias */}
        <div className="perfil-section">
          <h2>Preferencias de Viaje</h2>
          <div className="preferencias-grid">
            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="pref_notify_new_routes"
                  checked={!!prefs.notify_new_routes}
                  onChange={handleInputChange}
                  disabled={!editando}
                />
                <span className="slider"></span>
              </label>
              <span>Recibir notificaciones de nuevas rutas</span>
            </div>

            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="pref_show_full_name_to_drivers"
                  checked={!!prefs.show_full_name_to_drivers}
                  onChange={handleInputChange}
                  disabled={!editando}
                />
                <span className="slider"></span>
              </label>
              <span>Mostrar mi nombre completo a conductores</span>
            </div>

            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="pref_share_live_location"
                  checked={!!prefs.share_live_location}
                  onChange={handleInputChange}
                  disabled={!editando}
                />
                <span className="slider"></span>
              </label>
              <span>Compartir mi ubicación en tiempo real</span>
            </div>

            <div className="preferencia-item">
              <label className="switch">
                <input
                  type="checkbox"
                  name="pref_trip_reminders"
                  checked={!!prefs.trip_reminders}
                  onChange={handleInputChange}
                  disabled={!editando}
                />
                <span className="slider"></span>
              </label>
              <span>Recordatorios de viajes programados</span>
            </div>
          </div>
        </div>

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
