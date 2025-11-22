// src/pages/pasajero/SolicitarViaje.jsx
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../../styles/pasajero/solicitarViaje.css";

export default function SolicitarViaje() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    origen: "",
    destino: "",
    fecha: "",
    hora: "",
    asientos: 1,
    propina: 0,
    notas: ""
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validaciones básicas
    if (!formData.origen || !formData.destino || !formData.fecha || !formData.hora) {
      alert("Por favor completa todos los campos obligatorios.");
      return;
    }

    // Simular publicación del viaje
    console.log("Viaje solicitado:", formData);
    
    // Mostrar confirmación
    alert("¡Viaje solicitado exitosamente! Los conductores te harán ofertas pronto.");
    
    // Redirigir a búsqueda
    navigate('/pasajero/busqueda');
  };

  const calcularPrecioEstimado = () => {
    // Simulación de cálculo de precio basado en distancia
    const basePrice = 30;
    const seatMultiplier = formData.asientos * 5;
    const tip = parseInt(formData.propina) || 0;
    return basePrice + seatMultiplier + tip;
  };

  return (
    <div className="solicitar-viaje">
      <div className="solicitar-header">
        <h1>Solicitar Viaje Personalizado</h1>
        <p>Publica tu viaje y recibe ofertas de conductores</p>
      </div>

      <form onSubmit={handleSubmit} className="solicitar-form">
        <div className="form-section">
          <h3>📍 Detalles del Viaje</h3>
          
          <div className="input-group">
            <label>Origen *</label>
            <input
              type="text"
              name="origen"
              value={formData.origen}
              onChange={handleInputChange}
              placeholder="¿Dónde te encuentras?"
              required
            />
          </div>

          <div className="input-group">
            <label>Destino *</label>
            <input
              type="text"
              name="destino"
              value={formData.destino}
              onChange={handleInputChange}
              placeholder="¿A dónde quieres ir?"
              required
            />
          </div>

          <div className="input-row">
            <div className="input-group">
              <label>Fecha *</label>
              <input
                type="date"
                name="fecha"
                value={formData.fecha}
                onChange={handleInputChange}
                required
                min={new Date().toISOString().split('T')[0]}
              />
            </div>

            <div className="input-group">
              <label>Hora *</label>
              <input
                type="time"
                name="hora"
                value={formData.hora}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>👥 Detalles Adicionales</h3>
          
          <div className="input-group">
            <label>Número de Asientos</label>
            <select
              name="asientos"
              value={formData.asientos}
              onChange={handleInputChange}
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <option key={num} value={num}>{num} asiento{num > 1 ? 's' : ''}</option>
              ))}
            </select>
          </div>

          <div className="input-group">
            <label>Propina Sugerida ($)</label>
            <select
              name="propina"
              value={formData.propina}
              onChange={handleInputChange}
            >
              <option value="0">Sin propina</option>
              <option value="10">$10 - Generosa</option>
              <option value="20">$20 - Muy generosa</option>
              <option value="30">$30 - Excelente</option>
            </select>
          </div>

          <div className="input-group">
            <label>Notas Adicionales (Opcional)</label>
            <textarea
              name="notas"
              value={formData.notas}
              onChange={handleInputChange}
              placeholder="Ej: Equipaje extra, parada específica, etc."
              rows="3"
            />
          </div>
        </div>

        {/* Resumen del viaje */}
        <div className="resumen-viaje">
          <h3>📋 Resumen de tu Solicitud</h3>
          <div className="resumen-details">
            <div className="resumen-item">
              <span>Origen:</span>
              <span>{formData.origen || "Por definir"}</span>
            </div>
            <div className="resumen-item">
              <span>Destino:</span>
              <span>{formData.destino || "Por definir"}</span>
            </div>
            <div className="resumen-item">
              <span>Fecha y Hora:</span>
              <span>{formData.fecha && formData.hora ? `${formData.fecha} a las ${formData.hora}` : "Por definir"}</span>
            </div>
            <div className="resumen-item">
              <span>Asientos:</span>
              <span>{formData.asientos}</span>
            </div>
            <div className="resumen-item">
              <span>Propina:</span>
              <span>${formData.propina}</span>
            </div>
            <div className="resumen-item precio-total">
              <span>Precio Estimado:</span>
              <span>${calcularPrecioEstimado()}</span>
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn-secondary" onClick={() => navigate('/pasajero')}>
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            🚗 Publicar Solicitud de Viaje
          </button>
        </div>
      </form>

      {/* Información importante */}
      <div className="info-importante">
        <h4>💡 ¿Cómo funciona?</h4>
        <ul>
          <li>Publica tu viaje con al menos 1 hora de anticipación</li>
          <li>Los conductores verán tu solicitud y harán ofertas</li>
          <li>Recibirás notificaciones cuando un conductor acepte tu viaje</li>
          <li>Puedes coordinar detalles por WhatsApp una vez confirmado</li>
        </ul>
      </div>
    </div>
  );
}