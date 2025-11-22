// src/components/wallet/WalletView.jsx
import React, { useEffect, useMemo, useState } from 'react';

export default function WalletView({ userId }) {
  const token = useMemo(() => localStorage.getItem('colibri:token') || '', []);
  const base = 'http://localhost:8080/wallet';

  const [acc, setAcc] = useState(null);
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(false);

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  const refreshAll = async () => {
    setLoading(true);
    try {
      // Cuenta
      const r1 = await fetch(`${base}/accounts/${userId}`, { headers });
      const a = await r1.json();
      setAcc(a);

      // Ledger
      const r2 = await fetch(`${base}/ledger/${userId}?limit=50`, { headers });
      const l = await r2.json();
      setLedger(l || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refreshAll(); /* on mount */ }, []);

  const doHold = async () => {
    await fetch(`${base}/hold`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation_id: `op-hold-${Date.now()}`,
        user_id: userId,
        amount_cents: 5000,
        currency: 'MXN',
        reservation_id: '00000000-0000-0000-0000-000000000001'
      })
    });
    await refreshAll();
  };

  const doCapture = async () => {
    const holdOp = prompt('operation_id del HOLD a capturar:');
    const amt = Number(prompt('Monto a capturar (cents):', '3000'));
    await fetch(`${base}/capture`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation_id: `op-cap-${Date.now()}`,
        user_id: userId,
        hold_operation_id: holdOp,
        amount_cents: amt,
        reservation_id: '00000000-0000-0000-0000-000000000001'
      })
    });
    await refreshAll();
  };

  const doRelease = async () => {
    const holdOp = prompt('operation_id del HOLD a liberar:');
    await fetch(`${base}/release`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation_id: `op-rel-${Date.now()}`,
        user_id: userId,
        hold_operation_id: holdOp,
        reason: 'cancel'
      })
    });
    await refreshAll();
  };

  const doRefund = async () => {
    const amt = Number(prompt('Monto a reembolsar (cents):', '1000'));
    await fetch(`${base}/refund`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        operation_id: `op-ref-${Date.now()}`,
        user_id: userId,
        amount_cents: amt,
        reservation_id: '00000000-0000-0000-0000-000000000001',
        reason: 'goodwill'
      })
    });
    await refreshAll();
  };

  return (
    <div style={{ padding: 20, color: '#fff', background: '#0B132B', minHeight: '100vh' }}>
      <h2 style={{ marginBottom: 16 }}>Wallet — Usuario {userId}</h2>
      {loading && <p>Cargando...</p>}

      {acc && (
        <div style={{
          background: '#1C2541', padding: 16, borderRadius: 12, marginBottom: 16,
          border: '1px solid rgba(91,192,190,0.2)'
        }}>
          <p><b>Moneda:</b> {acc.currency}</p>
          <p><b>Balance:</b> ${(Number(acc.balance_cents)/100).toFixed(2)}</p>
          <p><b>En hold:</b> ${(Number(acc.hold_cents)/100).toFixed(2)}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={doHold}>Hacer HOLD $50</button>
        <button onClick={doCapture}>CAPTURE parcial</button>
        <button onClick={doRelease}>RELEASE hold</button>
        <button onClick={doRefund}>REFUND $10</button>
        <button onClick={refreshAll}>Refrescar</button>
      </div>

      <h3>Ledger (últimos)</h3>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', background: '#1C2541', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign:'left', padding: 8, borderBottom: '1px solid #2E96F5' }}>Fecha</th>
              <th style={{ textAlign:'left', padding: 8, borderBottom: '1px solid #2E96F5' }}>Tipo</th>
              <th style={{ textAlign:'left', padding: 8, borderBottom: '1px solid #2E96F5' }}>OpID</th>
              <th style={{ textAlign:'right', padding: 8, borderBottom: '1px solid #2E96F5' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {ledger.map(row => (
              <tr key={row.id}>
                <td style={{ padding: 8, borderBottom: '1px solid #0F2040' }}>{new Date(row.created_at).toLocaleString()}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #0F2040' }}>{row.type}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #0F2040', fontFamily: 'monospace' }}>{row.operation_id}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #0F2040', textAlign: 'right' }}>
                  {(Number(row.amount_cents)/100).toFixed(2)} {row.currency}
                </td>
              </tr>
            ))}
            {ledger.length === 0 && (
              <tr><td colSpan={4} style={{ padding: 8 }}>Sin movimientos.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
