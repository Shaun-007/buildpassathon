// Security routes: verify a QR token, record entry/exit, and the activity log.
const { Router } = require('express');
const { requireRole } = require('../session');

const ENTRY = 'ENTRY';
const EXIT = 'EXIT';

module.exports = function securityRoutes({ db }) {
  const router = Router();

  // Decide if a pass is usable right now, and why. Expired passes are not
  // stored as a status - the current time is compared against the return time.
  // This helper is used by BOTH verification and recording so an expired pass
  // cannot be recorded by bypassing the verification screen.
  async function checkPass(pass) {
    const student = await db.get('SELECT name, loginId, roomNumber FROM users WHERE id = ?', [pass.studentId]);
    const lastLog = await db.get(
    'SELECT action FROM gate_logs WHERE gatePassId = ? ORDER BY id DESC LIMIT 1', [pass.id]);

    if (pass.status === 'PENDING') {
      return { valid: false, reason: 'This pass has not been approved by the warden yet.' };
    }
    if (pass.status === 'REJECTED') {
      return { valid: false, reason: 'This pass was rejected by the warden.' };
    }
    if (pass.status === 'BLOCKED' || pass.blockedAt) {
      return { valid: false, reason: `BLOCKED BY GA${pass.blockReason ? `: ${pass.blockReason}` : ''}` };
    }
    if (lastLog && lastLog.action === ENTRY) {
      return { valid: false, reason: 'ALREADY USED: this pass has been completed.' };
    }
    const expiry = new Date(pass.toDateTime);
    if (Number.isNaN(expiry.getTime())) {
      return { valid: false, reason: 'This pass has an invalid return time and cannot be used.' };
    }
    if (expiry.getTime() <= Date.now()) {
      return { valid: false, reason: 'This pass has expired.' };
    }

    return {
      valid: true,
      lastAction: lastLog ? lastLog.action : null,
      pass: {
        id: pass.id,
        studentName: student ? student.name : 'Unknown',
        studentLoginId: student ? student.loginId : '-',
        roomNumber: student ? student.roomNumber : '-',
        reason: pass.reason,
        fromDateTime: pass.fromDateTime,
        toDateTime: pass.toDateTime,
        qrToken: pass.qrToken,
      },
    };
  }

  // GET /api/security/verify?token=GP-XXXX
  // The guard types or scans the token and learns whether the pass is valid.
  router.get('/verify', requireRole('SECURITY'), async (req, res) => {
    try {
      const token = (req.query.token || '').trim();
      if (!token) return res.status(400).json({ error: 'Please enter or scan a pass token.' });

      const pass = await db.get('SELECT * FROM gate_passes WHERE qrToken = ?', [token]);
      if (!pass) return res.json({ valid: false, reason: 'No gate pass found for this token.' });

      res.json(await checkPass(pass));
    } catch (err) {
      console.error('Verify pass error:', err);
      res.status(500).json({ error: 'Failed to verify pass.' });
    }
  });

  // POST /api/security/record  { gatePassId, action: 'ENTRY' | 'EXIT' }
  router.post('/record', requireRole('SECURITY'), async (req, res) => {
    try {
      const { gatePassId, action } = req.body || {};
      if (action !== ENTRY && action !== EXIT) {
        return res.status(400).json({ error: 'Action must be ENTRY or EXIT.' });
      }

      const pass = await db.get('SELECT * FROM gate_passes WHERE id = ?', [gatePassId]);
      if (!pass) return res.status(404).json({ error: 'Gate pass not found.' });

      // Re-verify the pass at the exact moment a gate action is recorded.
      // Never trust the earlier verification result: the pass may have expired
      // between scanning and pressing EXIT/ENTRY.
      const currentCheck = await checkPass(pass);
      if (!currentCheck.valid) {
        return res.status(400).json({ error: currentCheck.reason });
      }

      // Check the current movement state of this pass.
      const lastLog = await db.get(
        'SELECT * FROM gate_logs WHERE gatePassId = ? ORDER BY id DESC LIMIT 1',
        [pass.id]
      );

      // First action must always be EXIT.
      if (!lastLog && action !== EXIT) {
        return res.status(400).json({
          error: 'The student must EXIT the campus before an ENTRY can be recorded.',
        });
      }

      // After EXIT, the only valid next action is ENTRY.
      if (lastLog && lastLog.action === EXIT && action !== ENTRY) {
        return res.status(400).json({
          error: 'EXIT has already been recorded. The next action must be ENTRY.',
        });
      }

      // After ENTRY, the pass is completed and cannot be used again.
      if (lastLog && lastLog.action === ENTRY) {
        return res.status(400).json({
          error: 'This pass has already been completed. No more ENTRY or EXIT actions can be recorded.',
        });
      }

      await db.run(
        'INSERT INTO gate_logs (gatePassId, studentId, action, timestamp) VALUES (?, ?, ?, ?)',
        [pass.id, pass.studentId, action, new Date().toISOString()]
      );

      res.json(await checkPass(pass));
    } catch (err) {
      console.error('Record gate action error:', err);
      res.status(500).json({ error: 'Failed to record entry/exit.' });
    }
  });

  // GET /api/security/activity  -> recent gate activity for the screens.
  router.get('/activity', requireRole('SECURITY', 'WARDEN'), async (req, res) => {
    try {
      const logs = await db.all(`
        SELECT gate_logs.*, users.name AS studentName, users.roomNumber, gate_passes.reason
        FROM gate_logs
        JOIN users ON users.id = gate_logs.studentId
        JOIN gate_passes ON gate_passes.id = gate_logs.gatePassId
        ORDER BY gate_logs.id DESC
        LIMIT 20
      `);
      res.json({ logs });
    } catch (err) {
      console.error('Activity logs error:', err);
      res.status(500).json({ error: 'Failed to fetch gate activity.' });
    }
  });

  return router;
};
