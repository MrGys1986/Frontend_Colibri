import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import "../styles/registro.css";

export default function Registro() {
  const navigate = useNavigate();
  const location = useLocation();
  const rolSeleccionado = location.state?.rol || "Cliente";

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [dateBirth, setDateBirth] = useState("");
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // === VALIDACIONES DE FRONT ===
  const validarCorreo = (email) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const reglasPassword = {
    longitud: (p) => p.length >= 8,
    mayuscula: (p) => /[A-Z]/.test(p),
    minuscula: (p) => /[a-z]/.test(p),
    numero: (p) => /\d/.test(p),
    especial: (p) => /[^A-Za-z0-9]/.test(p),
  };

  const handleRegistro = async (e) => {
    e.preventDefault();
    setMessage("");

    if (!validarCorreo(email)) {
      setMessage("El correo no es válido.");
      return;
    }

    const cumplePassword =
      reglasPassword.longitud(password) &&
      reglasPassword.mayuscula(password) &&
      reglasPassword.minuscula(password) &&
      reglasPassword.numero(password) &&
      reglasPassword.especial(password);

    if (!cumplePassword) {
      setMessage("La contraseña no cumple todos los requisitos.");
      return;
    }

    if (password !== confirmar) {
      setMessage("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("https://c-apigateway.onrender.com/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          full_name: fullName,
          date_birth: dateBirth,
          role: rolSeleccionado === "Conductor" ? "DRIVER" : "USER",
        }),
      });

      const data = await res.json();

      if (res.ok) {
        alert("✅ Registro exitoso. Ahora puedes iniciar sesión.");
        navigate("/");
      } else {
        setMessage(data.message || "Error al registrar el usuario.");
      }
    } catch (error) {
      console.error("Error:", error);
      setMessage("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registro-container">
      {/* === Título === */}
      <h1 className="page-title">Crear cuenta</h1>

      <div className="registro-card">
        <div className="registro-header">
          <img src="/colibri.png" alt="Logo Colibri" className="logo-img-new" />

          <h2 className="registro-title">Registro de {rolSeleccionado}</h2>
          <p className="registro-subtitle">
            Solo toma un minuto. ¡Vamos a volar alto juntos 🚀!
          </p>
        </div>

        <form onSubmit={handleRegistro} className="registro-form">
          
          <label className="input-label">Nombre completo</label>
          <div className="input-group">
            <input
              type="text"
              placeholder="Tu nombre completo"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>

          <label className="input-label">Correo electrónico</label>
          <div className="input-group">
            <input
              type="email"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <label className="input-label">Fecha de nacimiento</label>
          <div className="input-group date-input">
            <input
              type="date"
              value={dateBirth}
              onChange={(e) => setDateBirth(e.target.value)}
              onFocus={(e) => e.target.showPicker && e.target.showPicker()}
              required
            />
            <span className="calendar-icon">📅</span>
          </div>

          <label className="input-label">Contraseña</label>
          <div className="input-group">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="show-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Ocultar" : "Ver"}
            </button>
          </div>

          {/* === Reglas visuales === */}
          <div className="password-rules">
            <p className={reglasPassword.longitud(password) ? "ok" : "bad"}>
              {reglasPassword.longitud(password) ? "✔" : "✖"} Mínimo 8 caracteres
            </p>
            <p className={reglasPassword.mayuscula(password) ? "ok" : "bad"}>
              {reglasPassword.mayuscula(password) ? "✔" : "✖"} Una mayúscula
            </p>
            <p className={reglasPassword.minuscula(password) ? "ok" : "bad"}>
              {reglasPassword.minuscula(password) ? "✔" : "✖"} Una minúscula
            </p>
            <p className={reglasPassword.numero(password) ? "ok" : "bad"}>
              {reglasPassword.numero(password) ? "✔" : "✖"} Un número
            </p>
            <p className={reglasPassword.especial(password) ? "ok" : "bad"}>
              {reglasPassword.especial(password) ? "✔" : "✖"} Un símbolo especial
            </p>
          </div>

          <label className="input-label">Confirmar contraseña</label>
          <div className="input-group">
            <input
              type={showConfirm ? "text" : "password"}
              placeholder="Repite tu contraseña"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              required
            />
            <button
              type="button"
              className="show-password"
              onClick={() => setShowConfirm(!showConfirm)}
            >
              {showConfirm ? "Ocultar" : "Ver"}
            </button>
          </div>

          <button type="submit" className="btn-login" disabled={loading}>
            {loading ? "Registrando..." : "Crear cuenta"}
          </button>

          <p className="register-text">
            ¿Ya tienes cuenta? <a href="/">Inicia sesión</a>
          </p>
        </form>

        {message && <p className="msg">{message}</p>}
      </div>

      <div className="legal-section">
        <p className="legal-text">
          Al registrarte, aceptas nuestros{" "}
          <a href="https://axel-j-aa.github.io/colibri-privacy/TyC.html" target="_blank">
            Términos y Condiciones
          </a>{" "}
          y nuestra{" "}
          <a href="https://axel-j-aa.github.io/colibri-privacy/privacidad.html" target="_blank">
            Política de Privacidad
          </a>.
        </p>
      </div>

    </div>
  );
}
