// pages/Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/login.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    localStorage.removeItem("colibri:user");
    localStorage.removeItem("colibri:access_token");
    localStorage.removeItem("colibri:refresh_token");
  }, []);

  const doLogin = async () => {
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("https://c-apigateway.onrender.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.message || "Credenciales inválidas");
        return;
      }

      let roleName = "";
      const roleRaw = data.user.role;
      const roleNumeric =
        typeof roleRaw === "number"
          ? roleRaw
          : roleRaw === "DRIVER"
          ? 3
          : roleRaw === "USER"
          ? 1
          : 0;

      roleName = roleNumeric === 3 ? "Conductor" : roleNumeric === 1 ? "Usuario" : "Desconocido";

      const userData = { ...data.user, role: roleName };
      localStorage.setItem("colibri:user", JSON.stringify(userData));
      localStorage.setItem("colibri:access_token", data.access_token);
      localStorage.setItem("colibri:refresh_token", data.refresh_token);

      if (roleNumeric === 3) {
        navigate(`/conductor/${data.user.id}`);
      } else if (roleNumeric === 1) {
        navigate(`/pasajero/${data.user.id}`);
      } else {
        navigate("/");
      }
    } catch (err) {
      console.error("Error al iniciar sesión:", err);
      setMessage("Error al conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">

      {/* === Nuevo título fuera de la tarjeta === */}
      <h1 className="page-title">Iniciar sesión</h1>

      <div className="login-card">
        <div className="login-header">

          {/* === Logo ahora más grande y sin círculo === */}
          <img src="/colibri.png" alt="Logo Colibrí" className="logo-img-new" />

          <h2 className="welcome-title">Bienvenido</h2>
          <p className="welcome-subtitle">
            ¡Qué gusto tenerte de vuelta!  
            <br />Estamos listos para llevarte a donde necesites 🚗✨
          </p>
        </div>

        <form className="login-form" onSubmit={(e) => e.preventDefault()}>
          <label htmlFor="email" className="input-label">Correo electrónico</label>
          <div className="input-group">
            <input
              id="email"
              type="email"
              placeholder="ejemplo@correo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </div>

          <label htmlFor="password" className="input-label">Contraseña</label>
          <div className="input-group">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <button
              type="button"
              className="show-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Ocultar" : "Mostrar"}
            </button>
          </div>

          <button type="button" className="btn-login" onClick={doLogin} disabled={loading}>
            {loading ? "Iniciando..." : "Iniciar sesión"}
          </button>

          <p className="register-text">
            ¿No tienes cuenta? <a href="/rol">Regístrate aquí</a>
          </p>
        </form>

        {message && <p className="msg">{message}</p>}
      </div>
    </div>
  );
}
