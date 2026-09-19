import React from 'react';

export default function Navbar({ user, onLogout }) {
  return (
    <header className="topbar">
      <div className="brand-logo">
        🏠 Genesis <span>GatePass</span>
      </div>

      {user && (
        <div className="user-chip">
          <span>
            <strong>{user.name}</strong> ({user.loginId})
            <span className={`badge ${user.role}`} style={{ marginLeft: 8 }}>
              {user.role}
            </span>
          </span>
          <button className="logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      )}
    </header>
  );
}
