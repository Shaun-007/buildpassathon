// Starts the web server: /api routes + the built React app.
// Run with:  npm start   then open http://localhost:3000

const express = require('express');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');

const { openDatabase } = require('./database');
const authRoutes = require('./routes/auth');
const gatePassRoutes = require('./routes/gatepass');
const securityRoutes = require('./routes/security');
const gaRoutes = require('./routes/ga');
const notificationRoutes = require('./routes/notifications');
const { readSessionToken } = require('./session');

const PORT = process.env.PORT || 3000;

async function createApp() {
  const db = await openDatabase();
  const app = express();

  // Allow the Vercel frontend + localhost to call this backend from a browser.
  app.use(
    cors({
      origin: (origin, callback) => {
        // No origin (curl, server-to-server) is always fine.
        if (!origin) return callback(null, true);
        // Hackathon-friendly: accept any origin. Tighten this later if needed.
        return callback(null, true);
      },
      credentials: true,
    })
  );

  app.use(express.json());

  // Attach the logged-in user to every request as req.user (or null).
  app.use(async (req, res, next) => {
    try {
      const token = readSessionToken(req);
      if (!token) {
        req.user = null;
        return next();
      }
      const session = await db.get('SELECT userId FROM sessions WHERE token = ?', [token]);
      req.user = session
        ? await db.get('SELECT * FROM users WHERE id = ?', [session.userId])
        : null;
      next();
    } catch (err) {
      console.error('Session middleware error:', err);
      req.user = null;
      next();
    }
  });

  // Health check, for Render / Railway monitoring.
  app.get('/health', (req, res) => {
    res.json({
      status: 'ok',
      database: db.isCloud ? 'turso' : 'sqlite-local',
      timestamp: new Date().toISOString(),
    });
  });

  // API routes.
  app.use('/api/auth', authRoutes({ db }));
  app.use('/api/gatepasses', gatePassRoutes({ db }));
  app.use('/api/security', securityRoutes({ db }));
  app.use('/api/ga', gaRoutes({ db }));
  app.use('/api/notifications', notificationRoutes({ db }));

  // Serve the React app (built dist/ if it exists, otherwise frontend/).
  const distDir = path.join(__dirname, '..', 'dist');
  const frontendDir = path.join(__dirname, '..', 'frontend');
  const staticDir = fs.existsSync(distDir) ? distDir : frontendDir;
  app.use(express.static(staticDir));

  // SPA fallback: any non-API GET returns the single frontend page.
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    const indexPath = path.join(staticDir, 'index.html');
    if (fs.existsSync(indexPath)) return res.sendFile(indexPath);
    next();
  });

  return { app, db };
}

async function startServer() {
  const { app, db } = await createApp();
  app.listen(PORT, () => {
    console.log(`Hostel Gatepass backend running at http://localhost:${PORT}`);
    console.log(`Database mode: ${db.isCloud ? 'Turso Cloud' : 'Local SQLite'}`);
    console.log('Demo logins: STU001/student123, WARDEN01/warden123, SEC01/security123');
  });
}

if (require.main === module) {
  startServer().catch((err) => {
    console.error('Server startup failed:', err);
    process.exit(1);
  });
}

module.exports = { createApp, startServer };
