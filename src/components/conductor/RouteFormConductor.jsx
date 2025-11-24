// src/components/conductor/RouteFormConductor.jsx
import React, { useMemo } from "react";

export default function RouteFormConductor({
  formData,
  markers,
  totalSuggested,
  canGoDest,
  canGoStops,
  canDetails,
  canSubmit,
  handleFormChange,
  handleCreateRoute,
  openModalFor,
  onConfirmModal,     // reservado por si lo necesitas después
  removeStop,
  updatePrice,
  openSchedulePicker,
  scheduleRef,
  getMarkerIcon,      // reservado si luego usas mini-mapa aquí
  currentPosition,    // igual
  showToastMsg,
}) {
  const stops = formData.stops || [];
  const prices = formData.prices || [];

  // número de tramos = paradas + 1
  const segmentsCount = useMemo(
    () => (stops.length || 0) + 1,
    [stops.length]
  );

  const pricesBySegment = useMemo(
    () =>
      Array.from({ length: segmentsCount }, (_, i) =>
        prices[i] === 0 || prices[i] ? prices[i] : ""
      ),
    [segmentsCount, prices]
  );

  const handlePriceChange = (index, value) => {
    updatePrice(index, value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleCreateRoute(e);
  };

  return (
    <div className="create-ruta-form">
      <form onSubmit={handleSubmit}>
        {/* ===========================
            Paso 1: Origen
        ============================ */}
        <div className="route-step">
          <div className="route-step-header">
            <span className="route-step-index">1</span>
            <div>
              <h3 className="route-step-title">Punto de partida</h3>
              <p className="route-step-subtitle">
                Define dónde iniciarás tu ruta.
              </p>
            </div>
          </div>

          <div className="route-step-body">
            <div className="route-field-line">
              <div className="route-field-label">Origen seleccionado</div>
              <div className="route-field-value">
                {formData.originLabel
                  ? formData.originLabel
                  : "Sin seleccionar"}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline-primary route-btn-block"
              onClick={() => openModalFor("origin")}
            >
              {formData.originLabel ? "Cambiar origen" : "Elegir en mapa"}
            </button>
          </div>
        </div>

        {/* ===========================
            Paso 2: Destino
        ============================ */}
        <div className={`route-step ${!canGoDest ? "route-step-disabled" : ""}`}>
          <div className="route-step-header">
            <span className="route-step-index">2</span>
            <div>
              <h3 className="route-step-title">Destino</h3>
              <p className="route-step-subtitle">
                El lugar donde termina tu viaje.
              </p>
            </div>
          </div>

          <div className="route-step-body">
            {!canGoDest && (
              <p className="route-help-text">
                Primero selecciona el punto de partida.
              </p>
            )}

            <div className="route-field-line">
              <div className="route-field-label">Destino seleccionado</div>
              <div className="route-field-value">
                {formData.destLabel ? formData.destLabel : "Sin seleccionar"}
              </div>
            </div>

            <button
              type="button"
              className="btn btn-outline-primary route-btn-block"
              onClick={() => openModalFor("dest")}
              disabled={!canGoDest}
            >
              {formData.destLabel ? "Cambiar destino" : "Elegir en mapa"}
            </button>
          </div>
        </div>

        {/* ===========================
            Paso 3: Paradas y precios
        ============================ */}
        <div className={`route-step ${!canGoStops ? "route-step-disabled" : ""}`}>
          <div className="route-step-header">
            <span className="route-step-index">3</span>
            <div>
              <h3 className="route-step-title">Paradas y precios</h3>
              <p className="route-step-subtitle">
                Agrega paradas intermedias y define el precio por tramo.
              </p>
            </div>
          </div>

          <div className="route-step-body">
            {!canGoStops && (
              <p className="route-help-text">
                Selecciona primero origen y destino para configurar paradas.
              </p>
            )}

            {/* Paradas */}
            <div className="route-subsection">
              <div className="route-subsection-header">
                <h4>Paradas intermedias</h4>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => openModalFor("stop")}
                  disabled={!canGoStops}
                >
                  ➕ Agregar parada
                </button>
              </div>

              {stops.length === 0 ? (
                <p className="route-muted">
                  No hay paradas agregadas. (Opcional)
                </p>
              ) : (
                <ul className="route-stops-list">
                  {stops.map((s, idx) => (
                    <li key={idx} className="route-stop-item">
                      <div className="route-stop-info">
                        <span className="route-stop-tag">P{idx + 1}</span>
                        <span className="route-stop-label">
                          {s.label || "Parada sin nombre"}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="route-stop-remove"
                        onClick={() => removeStop(idx)}
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Precios por tramo */}
            {canGoStops && (
              <div className="route-subsection">
                <div className="route-subsection-header">
                  <h4>Precio por tramo</h4>
                  <span className="route-subsection-badge">
                    Tramos: {segmentsCount}
                  </span>
                </div>

                <div className="route-segments-grid">
                  {pricesBySegment.map((price, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === segmentsCount - 1;
                    const fromLabel = isFirst
                      ? "Origen"
                      : `Parada ${idx}`;
                    const toLabel = isLast
                      ? "Destino"
                      : `Parada ${idx + 1}`;

                    return (
                      <div key={idx} className="route-segment-card">
                        <div className="route-segment-path">
                          <span>{fromLabel}</span>
                          <span className="route-segment-arrow">→</span>
                          <span>{toLabel}</span>
                        </div>
                        <div className="route-segment-input">
                          <label>Monto de este tramo</label>
                          <div className="route-segment-input-inner">
                            <span className="currency-prefix">$</span>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={price}
                              onChange={(e) =>
                                handlePriceChange(idx, e.target.value)
                              }
                              className="form-control input-stop-price"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="route-summary-line">
                  <span>Total sugerido:</span>
                  <strong>${Number(totalSuggested || 0).toFixed(2)}</strong>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ===========================
            Paso 4: Detalles de la ruta
        ============================ */}
        <div className={`route-step ${!canDetails ? "route-step-disabled" : ""}`}>
          <div className="route-step-header">
            <span className="route-step-index">4</span>
            <div>
              <h3 className="route-step-title">Detalles de la ruta</h3>
              <p className="route-step-subtitle">
                Configura fecha, horario y asientos disponibles.
              </p>
            </div>
          </div>

          <div className="route-step-body">
            {!canDetails && (
              <p className="route-help-text">
                Completa primero los pasos anteriores.
              </p>
            )}

            {/* Fecha y hora */}
            <div className="form-group">
              <label htmlFor="schedule">Fecha y hora de salida</label>
              <div className="dt-wrapper">
                <input
                  id="schedule"
                  name="schedule"
                  type="datetime-local"
                  ref={scheduleRef}
                  value={formData.schedule || ""}
                  onChange={handleFormChange}
                  className="dt-input form-control"
                />
                <button
                  type="button"
                  className="dt-icon-btn"
                  onClick={openSchedulePicker}
                >
                  📅
                </button>
              </div>
              <small className="route-help-text">
                Toca el campo o el icono para abrir el calendario y seleccionar fecha y hora.
              </small>
            </div>

            {/* Asientos disponibles */}
            <div className="form-group">
              <label htmlFor="availableSeats">Asientos disponibles</label>
              <input
                id="availableSeats"
                name="availableSeats"
                type="number"
                min="1"
                className="form-control seats-input"
                value={formData.availableSeats || ""}
                onChange={handleFormChange}
              />
              <small className="route-help-text">
                Especifica cuántos lugares tienes disponibles en el vehículo.
              </small>
            </div>

            {/* Tipo de ruta: única o recurrente */}
            <div className="trip-type">
              <label className="trip-label" htmlFor="isOneTime">
                Ruta única (solo esta fecha)
                <input
                  id="isOneTime"
                  name="isOneTime"
                  type="checkbox"
                  checked={!!formData.isOneTime}
                  onChange={handleFormChange}
                />
              </label>

              <label className="trip-label" htmlFor="isRecurrent">
                Ruta recurrente
                <input
                  id="isRecurrent"
                  name="isRecurrent"
                  type="checkbox"
                  checked={!!formData.isRecurrent}
                  onChange={handleFormChange}
                />
              </label>
            </div>

            {formData.isRecurrent && (
              <div className="form-group mt-2">
                <label htmlFor="frequency">Frecuencia</label>
                <select
                  id="frequency"
                  name="frequency"
                  className="form-control"
                  value={formData.frequency || ""}
                  onChange={handleFormChange}
                >
                  <option value="">Selecciona una opción</option>
                  <option value="DAILY">Diaria</option>
                  <option value="WEEKLY">Semanal</option>
                  <option value="MONTHLY">Mensual</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* ===========================
            Footer / acciones
        ============================ */}
        <div className="create-sticky-footer">
          <div className="route-summary-line mb-2">
            <span>Ganancia estimada (suma de tramos):</span>
            <strong>${Number(totalSuggested || 0).toFixed(2)}</strong>
          </div>

          <button
            type="submit"
            className="btn btn-primary route-btn-submit"
            disabled={!canSubmit}
          >
            Publicar ruta
          </button>
        </div>
      </form>
    </div>
  );
}
