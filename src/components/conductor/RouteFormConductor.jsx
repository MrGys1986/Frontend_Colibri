import React, { useMemo, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline} from "react-leaflet";
import L from "leaflet";

const ARROYO_SECO_CENTER = [20.5888, -100.3899];

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
  onConfirmModal,
  removeStop,
  updatePrice,
  openSchedulePicker,
  getMarkerIcon,
  currentPosition,
  showToastMsg,
}) {
  const scheduleRef = useRef(null);
  const bigMapRef = useRef(null);

  const segments = useMemo(() => (formData.stops?.length || 0) + 1, [formData.stops]);
  const prices = useMemo(() => formData.prices || [], [formData.prices]);

  // ===== Validaciones “live” =====
  const priceCountOk = prices.length === segments;
  const allPricesFilled = priceCountOk && prices.every((p) => p !== "" && !isNaN(p));
  const seatsOk =
    formData.availableSeats !== "" && Number.isFinite(+formData.availableSeats) && +formData.availableSeats > 0;
  const scheduleOk = (() => {
    if (!formData.schedule) return false;
    const dt = new Date(formData.schedule);
    if (isNaN(dt.getTime())) return false;
    return dt.getTime() > Date.now() - 60_000;
  })();

  const readyToSubmit = canSubmit && priceCountOk && allPricesFilled && seatsOk && scheduleOk;

  // ===== Acciones rápidas de precios =====
  const setSamePriceForAll = (value) => {
    const val = value === "" ? "" : Number(value);
    const newPrices = Array.from({ length: segments }, () => (value === "" ? "" : (Number.isFinite(val) ? val : "")));
    newPrices.forEach((v, i) => updatePrice(i, v));
  };

  const distributeTotalAcrossSegments = (total) => {
    const t = Number(total);
    if (!Number.isFinite(t) || t <= 0) return;
    const base = Math.floor((t / segments) * 100) / 100;
    const remainderCents = Math.round(t * 100 - base * 100 * segments);
    const result = Array.from({ length: segments }, () => base);
    for (let i = 0; i < remainderCents; i++) result[i] = Math.round((result[i] + 0.01) * 100) / 100;
    result.forEach((v, i) => updatePrice(i, v));
  };

  const roundPricesTo = (step = 5) => {
    for (let i = 0; i < segments; i++) {
      const n = Number(prices[i]);
      if (!Number.isFinite(n)) continue;
      const rounded = Math.round(n / step) * step;
      updatePrice(i, rounded);
    }
  };

  // ===== Asientos: +/- =====
  const incSeats = (d) => {
    const cur = Number(formData.availableSeats || 0);
    const next = Math.max(1, Math.min(99, cur + d));
    handleFormChange({ target: { name: "availableSeats", value: String(next), type: "number" } });
  };

  return (
    <div className="conductor-home-form card p-4">
      {/* Stepper compacto superior */}
      <div className="create-header">
        <div className={`step-chip ${formData.originLabel ? "done" : "todo"}`}>
          <span>1</span> Origen
        </div>
        <div className={`step-chip ${formData.destLabel ? "done" : canGoDest ? "todo" : "lock"}`}>
          <span>2</span> Destino
        </div>
        <div className={`step-chip ${formData.stops.length ? "done" : canGoStops ? "todo" : "lock"}`}>
          <span>3</span> Paradas
        </div>
        <div className={`step-chip ${canDetails ? "todo" : "lock"}`}>
          <span>4</span> Detalles
        </div>
      </div>

      <form onSubmit={handleCreateRoute}>
        {/* === NUEVA GRILLA: izquierda (paso 1 y 2), derecha (paso 3 y 4), mapa abajo === */}
        <div className="form-grid-2col">

          {/* COLUMNA IZQUIERDA: Paso 1 y 2 */}
          <div className="grid-col-left">
            {/* Paso 1 – Origen */}
            <div className="card p-3 mb-3">
              <div className="step-head">
                <span className={`step-dot ${formData.originLabel ? "done" : ""}`}>1</span>
                <h5>Paso 1 – Lugar de partida</h5>
              </div>

              {formData.originLabel ? (
                <div className="alert alert-info py-2">
                  <strong>Origen:</strong>
                  <br /> {formData.originLabel}
                  <div className="mt-2 step-actions">
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openModalFor("origin")}>
                      Cambiar
                    </button>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onConfirmModal(null)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ) : (
                <p className="small text-muted">Selecciona tu punto de partida.</p>
              )}

              <div className="step-cta">
                <button type="button" className="btn btn-primary btn-lg w-100" onClick={() => openModalFor("origin")}>
                  {formData.originLabel ? "Cambiar Origen" : "Seleccionar Origen"}
                </button>
              </div>
            </div>

            {/* Paso 2 – Destino */}
            <div className={`card p-3 mb-3 ${!canGoDest ? "disabled-card" : ""}`}>
              <div className="step-head">
                <span className={`step-dot ${formData.destLabel ? "done" : ""}`}>2</span>
                <h5>Paso 2 – Destino</h5>
              </div>

              {!canGoDest && <p className="small text-muted">Primero confirma el origen.</p>}

              {formData.destLabel ? (
                <div className="alert alert-info py-2">
                  <strong>Destino:</strong>
                  <br /> {formData.destLabel}
                  <div className="mt-2 step-actions">
                    <button type="button" className="btn btn-outline-primary btn-sm" onClick={() => openModalFor("dest")}>
                      Cambiar
                    </button>
                    <button type="button" className="btn btn-outline-danger btn-sm" onClick={() => onConfirmModal(null)}>
                      Quitar
                    </button>
                  </div>
                </div>
              ) : canGoDest ? (
                <p className="small text-muted">Selecciona tu destino.</p>
              ) : null}

              <div className="step-cta">
                <button
                  type="button"
                  className="btn btn-primary btn-lg w-100"
                  disabled={!canGoDest}
                  onClick={() => openModalFor("dest")}
                >
                  {formData.destLabel ? "Cambiar Destino" : "Seleccionar Destino"}
                </button>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA: Paso 3 y 4 */}
          <div className="grid-col-right">
            {/* Paso 3 – Paradas y precios */}
            <div className={`card p-3 mb-3 ${!canGoStops ? "disabled-card" : ""}`}>
              <div className="step-head">
                <span className={`step-dot ${formData.stops.length ? "done" : ""}`}>3</span>
                <h5>Paso 3 – Paradas (opcional) y precios</h5>
              </div>

              {!canGoStops && <p className="small text-muted">Agrega destino para habilitar paradas.</p>}

              {canGoStops && (
                <>
                  {/* Lista de paradas */}
                  <div className="stops-prices-merged">
                    {formData.stops.length === 0 && (
                      <div className="text-muted">Aún no hay paradas. Agrega una usando el mapa.</div>
                    )}

                    {formData.stops.length > 0 && (
                      <div className="stops-list">
                        {formData.stops.map((s, idx) => (
                          <div key={`stop-${idx}`} className="stop-row">
                            <input
                              type="text"
                              className="form-control input-stop-name"
                              value={s.label}
                              readOnly
                              title={s.label}
                            />
                            <button
                              type="button"
                              className="btn btn-outline-danger"
                              onClick={() => removeStop(idx)}
                            >
                              Eliminar
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Inputs de precio por tramo */}
                    {(() => {
                      const segs = segments;
                      return (
                        <div className="segment-prices mt-2">
                          {Array.from({ length: segs }).map((_, i) => {
                            const label =
                              segs === 1
                                ? "Origen → Destino"
                                : i === 0
                                ? `Origen → ${formData.stops[0]?.label || "Parada 1"}`
                                : i === segs - 1
                                ? `${formData.stops[segs - 2]?.label || `Parada ${segs - 1}`} → Destino`
                                : `${formData.stops[i - 1]?.label || `Parada ${i}`} → ${
                                    formData.stops[i]?.label || `Parada ${i + 1}`
                                  }`;

                            return (
                              <div key={`seg-${i}`} className="stop-row price-row">
                                <div className="price-label-col">
                                  <label className="price-label small">{label}</label>
                                </div>
                                <div className="price-input-col">
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    className={`form-control input-stop-price ${prices[i] === "" ? "input-error" : ""}`}
                                    value={prices[i] ?? ""}
                                    onChange={(e) => updatePrice(i, e.target.value)}
                                    placeholder="$0.00"
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Validaciones y total */}
                  <div className="mt-2">
                    {!priceCountOk && (
                      <div className="inline-error">
                        Debes capturar <b>{segments}</b> precios (uno por cada tramo).
                      </div>
                    )}
                    {priceCountOk && !allPricesFilled && (
                      <div className="inline-error">Hay tramos sin precio. Complétalos para continuar.</div>
                    )}
                    <div className="suggested-pill">
                      Total (suma de tramos):{" "}
                      <strong>${Number.isFinite(totalSuggested) ? totalSuggested.toFixed(2) : "0.00"}</strong>
                    </div>
                  </div>

                  {/* Botón agregar parada */}
                  <div className="d-flex gap-2 mt-2">
                    <button
                      type="button"
                      className="btn btn-outline-primary w-50"
                      disabled={!canGoStops}
                      onClick={() => openModalFor("stop")}
                    >
                      + Agregar Parada
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Paso 4 – Detalles */}
            <div className={`card p-3 ${!canDetails ? "disabled-card" : ""}`}>
              <div className="step-head">
                <span className={`step-dot ${canDetails ? "active" : ""}`}>4</span>
                <h5>Paso 4 – Detalles</h5>
              </div>

              {/* Horario */}
              <div className="form-group dt-wrapper">
                <label>Horario:</label>
                <input
                  ref={scheduleRef}
                  type="datetime-local"
                  name="schedule"
                  value={formData.schedule}
                  onChange={handleFormChange}
                  disabled={!canDetails}
                  required={canDetails}
                  className={`dt-input ${!scheduleOk && formData.schedule ? "input-error" : ""}`}
                />
                <button
                  type="button"
                  className="dt-icon-btn"
                  onClick={openSchedulePicker}
                  aria-label="Abrir selector de fecha y hora"
                  disabled={!canDetails}
                  title="Abrir calendario y hora"
                >
                  📅
                </button>
                {!scheduleOk && formData.schedule && (
                  <div className="inline-error mt-1">Selecciona una fecha/hora futura.</div>
                )}
              </div>

              {/* Tipo de viaje */}
              <div className="form-group mt-2">
                <label>Tipo de Viaje:</label>

                <div className="trip-type">
                  <label className="trip-label">
                    <input
                      type="checkbox"
                      name="isOneTime"
                      checked={formData.isOneTime}
                      onChange={handleFormChange}
                      disabled={!canDetails}
                    />
                    Viaje Único
                  </label>

                  <label className="trip-label">
                    <input
                      type="checkbox"
                      name="isRecurrent"
                      checked={formData.isRecurrent}
                      onChange={handleFormChange}
                      disabled={!canDetails}
                    />
                    Recurrente
                  </label>
                </div>

                {formData.isRecurrent && (
                  <div className="mt-2">
                    <select
                      name="frequency"
                      value={formData.frequency}
                      onChange={handleFormChange}
                      disabled={!canDetails}
                    >
                      <option value="">Selecciona</option>
                      <option value="daily">Diario</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensual</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Asientos con +/- */}
              <div className="form-group mt-2">
                <label>Asientos Disponibles:</label>
                <div className="seats-row">
                  <button
                    type="button"
                    className="btn btn-outline-primary seats-btn"
                    onClick={() => incSeats(-1)}
                    disabled={!canDetails}
                    aria-label="Disminuir asientos"
                  >
                    −
                  </button>
                  <input
                    type="number"
                    name="availableSeats"
                    value={formData.availableSeats}
                    onChange={handleFormChange}
                    disabled={!canDetails}
                    min="1"
                    max="99"
                    placeholder="Ej. 4"
                    required={canDetails}
                    className={`dt-input seats-input ${!seatsOk && formData.availableSeats !== "" ? "input-error" : ""}`}
                  />
                  <button
                    type="button"
                    className="btn btn-outline-primary seats-btn"
                    onClick={() => incSeats(1)}
                    disabled={!canDetails}
                    aria-label="Aumentar asientos"
                  >
                    +
                  </button>
                </div>
                {!seatsOk && formData.availableSeats !== "" && (
                  <div className="inline-error mt-1">Debe ser un número mayor a 0.</div>
                )}
              </div>
            </div>
          </div>

          {/* MAPA ABAJO (ocupa el ancho completo) */}
          <div className="grid-map card p-2">
            <label className="mb-2">Mapa (vista de tus selecciones)</label>
            <div className="map-container" style={{ height: 360 }}>
              <MapContainer
                center={currentPosition || ARROYO_SECO_CENTER}
                zoom={12}
                whenCreated={(m) => (bigMapRef.current = m)}
                style={{ height: 460, width: "100%" }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                />
                {/* Polyline para el trazo de la ruta */}
                {(() => {
                  // Construir el array de puntos: origen, paradas, destino
                  const routePoints = [];
                  const origin = markers.find((m) => m.mode === "origin");
                  const dest = markers.find((m) => m.mode === "dest");
                  const stops = markers.filter((m) => m.mode === "stop");
                  if (origin) routePoints.push([origin.lat, origin.lng]);
                  stops.forEach((s) => routePoints.push([s.lat, s.lng]));
                  if (dest) routePoints.push([dest.lat, dest.lng]);
                  return routePoints.length > 1 ? (
                    <Polyline positions={routePoints} color="#8ecbff" />
                  ) : null;
                })()}
                {/* Marcadores originales */}
                {markers.map((m, idx) => (
                  <Marker key={`${m.mode}-${m.lat}-${m.lng}-${idx}`} position={[m.lat, m.lng]} icon={getMarkerIcon(m.mode)}>
                    <Popup>
                      {(m.mode === "origin" ? "O" : m.mode === "dest" ? "D" : "P") + " – "}
                      {m.label || "Dirección no disponible"}
                    </Popup>
                  </Marker>
                ))}
                {/* Numerar paradas */}
                {markers
                  .filter((m) => m.mode === "stop")
                  .map((m, idx) => (
                    <Marker
                      key={`stop-num-${idx}`}
                      position={[m.lat, m.lng]}
                      icon={L.divIcon({
                        className: "custom-stop-num",
                        html: `<div style="background:#fff;border-radius:50%;border:2px solid #007bff;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-weight:bold;color:#007bff;">P${idx + 1}</div>`,
                        iconSize: [28, 28],
                        iconAnchor: [14, 14],
                      })}
                    />
                  ))}
              </MapContainer>
            </div>
          </div>
        </div>

        {/* Footer sticky con CTA único */}
        <div className="create-sticky-footer">
          <div className="csf-route">
            <span className="csf-chip">{formData.originLabel ? "Origen" : "—"}</span>
            <span className="csf-sep">→</span>
            {formData.stops.map((s, i) => (
              <span key={i} className="csf-chip csf-stop">
                {s.label || `P${i + 1}`}
              </span>
            ))}
            <span className="csf-sep">→</span>
            <span className="csf-chip">{formData.destLabel ? "Destino" : "—"}</span>
          </div>
          <div className="csf-right">
            <div className="csf-total">
              Total: <b>${Number.isFinite(totalSuggested) ? totalSuggested.toFixed(2) : "0.00"}</b>
            </div>
            <button
              type="submit"
              className={`btn-primary ${!readyToSubmit ? "disabled" : ""}`}
              disabled={!readyToSubmit}
              title={!readyToSubmit ? "Completa los campos necesarios" : "Crear Ruta"}
            >
              Crear Ruta
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}