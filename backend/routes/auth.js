// Login / logout / "who am I?" routes.
const { Router } = require('express');
const crypto = require('node:crypto');
const { readSessionToken, requireRole } = require('../session');
const { hashPassword } = require('../database');

module.exports = function authRoutes({ db }) {
  const router = Router();

  // Maps a user row to the safe info the frontend receives.
  function publicUser(user) {
    return {
      id: user.id,
      name: user.name,
      loginId: user.loginId,
      role: user.role,
      roomNumber: user.roomNumber,
    };
  }

  // POST /api/auth/login  { loginId, password }
  router.post('/login', async (req, res) => {
    try {
      const { loginId, password } = req.body || {};
      if (!loginId || !password) {
        return res.status(400).json({ error: 'Please enter your ID and password.' });
      }

      const user = await db.get('SELECT * FROM users WHERE loginId = ?', [loginId]);
      if (!user || user.password !== hashPassword(password)) {
        return res.status(401).json({ error: 'Wrong ID or password.' });
      }

      // A new random token per login, stored so the backend recognizes the browser.
      const sessionToken = crypto.randomBytes(24).toString('hex');
      await db.run('INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)', [
        sessionToken,
        user.id,
        new Date().toISOString(),
      ]);

      // Cookie for same-origin/proxied setups...
      res.setHeader('Set-Cookie', `gp_session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax`);
      // ...and the token in JSON for the React app (kept in localStorage).
      res.json({ token: sessionToken, user: publicUser(user) });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ error: 'Failed to log in. Please try again.' });
    }
  });

  // POST /api/auth/logout
  router.post('/logout', async (req, res) => {
    try {
      const sessionToken = readSessionToken(req);
      if (sessionToken) {
        await db.run('DELETE FROM sessions WHERE token = ?', [sessionToken]);
      }
      res.setHeader('Set-Cookie', 'gp_session=; Path=/; Max-Age=0');
      res.json({ ok: true });
    } catch (err) {
      console.error('Logout error:', err);
      res.status(500).json({ error: 'Failed to log out.' });
    }
  });

  // GET /api/auth/me -> the logged-in user, so pages know who they are.
  router.get('/me', requireRole(), (req, res) => {
    res.json({ user: publicUser(req.user) });
  });

  return router;
};
