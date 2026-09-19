import React, { useState } from 'react';
import { api } from '../api';

const roleDefaults = {
  student: {
    label: 'Student Registration No / ID',
    placeholder: 'e.g. STU001',
    buttonText: 'Login as Student',
  },
  warden: {
    label: 'Warden Employee ID',
    placeholder: 'e.g. WARDEN01',
    buttonText: 'Login as Warden',
  },
  security: {
    label: 'Gate Security ID',
    placeholder: 'e.g. SEC01',
    buttonText: 'Login as Security',
  },
  ga: { label: 'GA Employee ID', placeholder: 'e.g. GA001', buttonText: 'Login as GA' },
};
const quickFillAccounts = {
  student: [
    { label: 'Rahul · STU001', loginId: 'STU001', password: 'student123' },
    { label: 'Priya · STU002', loginId: 'STU002', password: 'student123' },
  ],
  warden: [{ label: 'Mr. Sharma · WARDEN01', loginId: 'WARDEN01', password: 'warden123' }],
  security: [{ label: 'Gate Security · SEC01', loginId: 'SEC01', password: 'security123' }],
  ga: [{ label: 'Anu · GA001', loginId: 'GA001', password: 'ga123' }],
};

export default function Login({ onLoginSuccess }) {
  const [role, setRole] = useState('student');
  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const currentRoleConfig = roleDefaults[role];

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setError('');
  };
  const quickFill = (account) => {
    setLoginId(account.loginId);
    setPassword(account.password);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!loginId || !password) {
      setError('Please enter your ID and password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: { loginId, password },
      });
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main-container">
      <div className="bg-overlay"></div>

      <div className="login-card">
        <h1 className="card-title">Digital Gate Pass</h1>

        <div className="role-tabs">
          <button
            type="button"
            className={`role-tab ${role === 'student' ? 'active' : ''}`}
            onClick={() => handleRoleChange('student')}
          >
            Student
          </button>
          <button
            type="button"
            className={`role-tab ${role === 'warden' ? 'active' : ''}`}
            onClick={() => handleRoleChange('warden')}
          >
            Warden
          </button>
          <button
            type="button"
            className={`role-tab ${role === 'security' ? 'active' : ''}`}
            onClick={() => handleRoleChange('security')}
          >
            Security
          </button>
          <button type="button" className={`role-tab ${role === 'ga' ? 'active' : ''}`} onClick={() => handleRoleChange('ga')}>GA</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="loginId">{currentRoleConfig.label}</label>
            <input
              id="loginId"
              type="text"
              className="form-control"
              placeholder={currentRoleConfig.placeholder}
              value={loginId}
              onChange={(e) => setLoginId(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-submit" disabled={loading}>
            {loading ? 'Logging in...' : currentRoleConfig.buttonText}
          </button>

          <div className="quick-fill" aria-label="Demo account quick fill">
            <p>Demo quick fill</p>
            <div>
              {quickFillAccounts[role].map((account) => (
                <button type="button" className="quick-fill-button" key={account.loginId} onClick={() => quickFill(account)}>
                  {account.label}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="message error">{error}</p>}
        </form>
      </div>
    </div>
  );
}
