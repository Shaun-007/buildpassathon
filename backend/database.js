const { DatabaseSync } = require('node:sqlite');
const { createClient } = require('@libsql/client');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

function hashPassword(password) { return crypto.createHash('sha256').update(password).digest('hex'); }

async function openDatabase() {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  const db = (url || process.env.TURSO_AUTH_TOKEN) ? await openTurso(url, process.env.TURSO_AUTH_TOKEN) : openLocal();
  await createTables(db);
  await seedDemoUsers(db);
  return db;
}
async function openTurso(url, authToken) {
  const client = createClient({ url, authToken });
  return { isCloud: true,
    async get(sql, args = []) { return (await client.execute({ sql, args })).rows[0] || null; },
    async all(sql, args = []) { return (await client.execute({ sql, args })).rows; },
    async run(sql, args = []) { const r = await client.execute({ sql, args }); return { lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid), rowsAffected: r.rowsAffected || 0 }; },
    async exec(sql) { return client.executeMultiple(sql); },
  };
}
function openLocal() {
  const dbPath = path.join(__dirname, '..', 'data', 'gatepass.db'); fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const client = new DatabaseSync(dbPath);
  return { isCloud: false,
    get(sql, args = []) { return client.prepare(sql).get(...args) || null; }, all(sql, args = []) { return client.prepare(sql).all(...args); },
    run(sql, args = []) { const r = client.prepare(sql).run(...args); return { lastInsertRowid: r.lastInsertRowid == null ? null : Number(r.lastInsertRowid), rowsAffected: Number(r.changes || 0) }; }, exec(sql) { client.exec(sql); },
  };
}
async function addColumn(db, table, definition) { try { await db.exec(`ALTER TABLE ${table} ADD COLUMN ${definition}`); } catch (err) { if (!/duplicate column|already exists/i.test(err.message || '')) throw err; } }
async function createTables(db) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY AUTOINCREMENT, loginId TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password TEXT NOT NULL, role TEXT NOT NULL, roomNumber TEXT);
    CREATE TABLE IF NOT EXISTS gate_passes (id INTEGER PRIMARY KEY AUTOINCREMENT, studentId INTEGER NOT NULL, reason TEXT NOT NULL, fromDateTime TEXT NOT NULL, toDateTime TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', qrToken TEXT);
    CREATE TABLE IF NOT EXISTS gate_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, gatePassId INTEGER NOT NULL, studentId INTEGER NOT NULL, action TEXT NOT NULL, timestamp TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, userId INTEGER NOT NULL, createdAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS approval_history (id INTEGER PRIMARY KEY AUTOINCREMENT, gatePassId INTEGER NOT NULL, action TEXT NOT NULL, previousStatus TEXT, newStatus TEXT, performedBy INTEGER, performedAt TEXT NOT NULL, metadata TEXT);
    CREATE TABLE IF NOT EXISTS ga_applications (id INTEGER PRIMARY KEY AUTOINCREMENT, gaId INTEGER NOT NULL, gaName TEXT NOT NULL, studentName TEXT NOT NULL, studentClass TEXT NOT NULL, reason TEXT, destination TEXT, requestedDate TEXT, requestedTime TEXT, additionalNote TEXT, generatedLetter TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'PENDING', createdAt TEXT NOT NULL, approvedAt TEXT, approvedBy INTEGER, rejectedAt TEXT, rejectedBy INTEGER, rejectionReason TEXT);
    CREATE TABLE IF NOT EXISTS notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, userId INTEGER NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'GATEPASS_SUBMITTED', referenceId INTEGER, createdAt TEXT NOT NULL, readAt TEXT);
  `);
  for (const column of ['destination TEXT', 'description TEXT', 'type TEXT', 'approvedAt TEXT', 'approvedBy INTEGER', 'blockedAt TEXT', 'blockedBy INTEGER', 'blockReason TEXT', 'rejectedAt TEXT', 'rejectedBy INTEGER', 'reapprovalDeadline TEXT', "approvalType TEXT DEFAULT 'NORMAL'"]) await addColumn(db, 'gate_passes', column);
}
async function seedDemoUsers(db) {
  const users = [['STU001','Rahul','student123','STUDENT','B-204'],['STU002','Priya','student123','STUDENT','A-101'],['WARDEN01','Mr. Sharma','warden123','WARDEN',null],['SEC01','Gate Security','security123','SECURITY',null],['GA001','Anu','ga123','GA',null]];
  for (const u of users) if (!await db.get('SELECT id FROM users WHERE loginId = ?', [u[0]])) await db.run('INSERT INTO users (loginId,name,password,role,roomNumber) VALUES (?,?,?,?,?)', [u[0],u[1],hashPassword(u[2]),u[3],u[4]]);
}
module.exports = { openDatabase, hashPassword };
