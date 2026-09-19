const { Router } = require('express');
const { requireRole } = require('../session');

module.exports = ({ db }) => {
  const router = Router();
  router.get('/', requireRole('WARDEN'), async (req, res) => {
    try {
      const notifications = await db.all('SELECT * FROM notifications WHERE userId=? ORDER BY id DESC LIMIT 30', [req.user.id]);
      res.json({ notifications });
    } catch (err) { res.status(500).json({ error: 'Failed to fetch notifications.' }); }
  });
  router.post('/:id/read', requireRole('WARDEN'), async (req, res) => {
    try {
      await db.run('UPDATE notifications SET readAt=? WHERE id=? AND userId=?', [new Date().toISOString(), req.params.id, req.user.id]);
      res.json({ ok: true });
    } catch (err) { res.status(500).json({ error: 'Failed to update notification.' }); }
  });
  return router;
};
