import React, { useState } from 'react';
import { loginWithFirebase } from '../api.js';

const SESSION_KEY = 'taManagementAuth';

export function readAuthSession() {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session?.token || !session?.user?.email) return null;
    if (session.expiresAt && Date.now() > session.expiresAt) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function clearAuthSession() {
  localStorage.removeItem(SESSION_KEY);
}

function saveAuthSession(auth) {
  const expiresAt = Date.now() + Math.max(1, auth.expiresIn || 3600) * 1000;
  const session = { user: auth.user, token: auth.token, refreshToken: auth.refreshToken, expiresAt };
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

export default function LoginView({ onLogin }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await loginWithFirebase(email.trim(), password);
      if (res.error) setError(res.error);
      else onLogin(saveAuthSession(res));
    } catch (err) {
      setError(err.message || 'เข้าสู่ระบบไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <form className="login-panel" onSubmit={handleSubmit}>
        <div className="login-logo">TA</div>
        <h1>TA Management</h1>
        <p>เข้าสู่ระบบด้วยบัญชี Firebase</p>

        <label>
          อีเมล
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          รหัสผ่าน
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        {error && <div className="login-error">{error}</div>}

        <button className="btn btn-primary login-submit" disabled={loading || !email || !password}>
          {loading ? 'กำลังเข้าสู่ระบบ...' : 'เข้าสู่ระบบ'}
        </button>
      </form>
    </div>
  );
}
