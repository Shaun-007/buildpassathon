// Helpers that answer "who is logged in?" for the routes.

// The browser can send the session token four ways. We check them in order:
// 1. Authorization: Bearer <token>   (used by the React frontend -> localStorage)
// 2. x-session-token header
// 3. ?token=... query parameter        (handy for QR image tags)
// 4. Cookie named gp_session           (same-origin / proxied setups)
function readSessionToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }

  if (req.headers['x-session-token']) return req.headers['x-session-token'];

  if (req.query && req.query.token) return req.query.token;

  const cookies = req.headers.cookie;
  if (cookies) {
    for (const part of cookies.split(';')) {
      const [name, value] = part.trim().split('=');
      if (name === 'gp_session' && value) return value;
    }
  }

  return null;
}

// Express middleware: only let the request through if someone is logged in
// and (when roles are given) has one of those roles.
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Please log in first.' });
    }
    if (roles.length > 0 && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You are not allowed to do that.' });
    }
    next();
  };
}

module.exports = { readSessionToken, requireRole };