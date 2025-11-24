// src/lib/authClient.js
export class AuthClient {
  static BASE = 'https://c-apigateway.onrender.com';

  // 🔹 NUEVO: método estático que SÍ existe y es el que llama el Sidebar
  static normalizeTokensStorage() {
    try {
      // Usamos la instancia global para correr normalizeStorage
      authClient.normalizeStorage();
    } catch {
      // no reventamos la app por esto
    }
  }

  constructor() {
    this.subscribers = new Set();
    // Normalización inicial
    this.normalizeStorage();
  }

  // 🔹 Normaliza nombres viejos a los nuevos
  normalizeStorage() {
    try {
      const tokenOld = localStorage.getItem('colibri:token');
      const tokenNew = localStorage.getItem('colibri:access_token');
      const rtOld = localStorage.getItem('colibri:refresh');
      const rtNew = localStorage.getItem('colibri:refresh_token');

      // migra tokens viejos → nuevos
      if (tokenOld && !tokenNew) {
        localStorage.setItem('colibri:access_token', tokenOld);
        // opcional: limpia la vieja
        // localStorage.removeItem('colibri:token');
      }
      if (rtOld && !rtNew) {
        localStorage.setItem('colibri:refresh_token', rtOld);
        // opcional: limpia la vieja
        // localStorage.removeItem('colibri:refresh');
      }

      const uLS = localStorage.getItem('colibri:user');
      if (uLS) {
        const u = JSON.parse(uLS);
        let changed = false;
        const acc = localStorage.getItem('colibri:access_token');
        const ref = localStorage.getItem('colibri:refresh_token');

        if (acc && !u.access_token) {
          u.access_token = acc;
          changed = true;
        }
        if (ref && !u.refresh_token) {
          u.refresh_token = ref;
          changed = true;
        }

        if (changed) {
          localStorage.setItem('colibri:user', JSON.stringify(u));
        }
      }
    } catch {
      // ignoramos errores silenciosamente
    }
  }

  onTokenChange(cb) {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  emitTokenChange() {
    const tok = this.getAccessToken();
    for (const cb of this.subscribers) {
      try {
        cb(tok);
      } catch {}
    }
  }

  getAccessToken() {
    return localStorage.getItem('colibri:access_token') || '';
  }

  getRefreshToken() {
    return localStorage.getItem('colibri:refresh_token') || '';
  }

  setAccessToken(t) {
    localStorage.setItem('colibri:access_token', t || '');
    try {
      const raw = localStorage.getItem('colibri:user') || '{}';
      const u = JSON.parse(raw);
      if (u && typeof u === 'object') {
        u.access_token = t || '';
        u.token = t || '';
        u.accessToken = t || '';
        localStorage.setItem('colibri:user', JSON.stringify(u));
      }
    } catch {}
    this.emitTokenChange();
  }

  buildAuthHeaders(extra = {}) {
    const acc = this.getAccessToken();
    const hasBearer = /^Bearer\s+/i.test(acc);
    const authorization = acc ? (hasBearer ? acc : `Bearer ${acc}`) : '';
    const h = { 'content-type': 'application/json', ...extra };
    if (authorization) h.authorization = authorization;
    return h;
  }

  async refreshOnce() {
    const rt = this.getRefreshToken();
    if (!rt) return false;

    const candidates = [{ refreshToken: rt }, { refresh_token: rt }, { rt }];
    for (const body of candidates) {
      try {
        const res = await fetch(`${AuthClient.BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        });
        if (!res.ok) continue;

        const data = await res.json().catch(() => ({}));
        const newAccess =
          data?.access_token || data?.accessToken || data?.token || '';

        if (newAccess) {
          this.setAccessToken(newAccess);
          return true;
        }
      } catch {
        // ignoramos e intentamos siguiente candidato
      }
    }
    return false;
  }

  async fetch(url, init = {}, opts = { retryOn401: true }) {
    const headers = { ...this.buildAuthHeaders(), ...(init.headers || {}) };
    const res = await fetch(url, { ...init, headers });

    if (res.status === 401 && (opts?.retryOn401 ?? true)) {
      const ok = await this.refreshOnce();
      if (ok) {
        const headers2 = {
          ...this.buildAuthHeaders(),
          ...(init.headers || {}),
        };
        return fetch(url, { ...init, headers: headers2 });
      }
    }
    return res;
  }
}

// 🔹 instancia global
export const authClient = new AuthClient();
