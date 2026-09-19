# Genesis Digital GatePass Verification System

A dark, campus-themed hostel gate-pass platform with a React 19/Vite frontend, Express 5 API, and SQLite/libSQL storage. The built React application is served from `dist/` by the backend; Vite development mode proxies `/api` to port 3000.

## Roles and workflow

- **Student** — creates passes, follows decisions, and shows QR codes for active approvals.
- **Warden** — separately reviews pending/emergency/approved/rejected/all passes, a permanent Approval History audit tab, and formal GA Applications. A rejected pass can be re-approved only within the server-enforced 30-minute window.
- **GA** — views Monday–Saturday approved-pass history (Sunday is intentionally excluded), blocks an approved pass with a recorded reason, and sends formal Quick Applications to Wardens.
- **Security** — scans a QR code or enters its token, then records the required EXIT → ENTRY sequence. Verification is always backend-authoritative, including expiry, use state, rejection, and GA blocking.

GA blocking changes the active pass state to `BLOCKED`, preserves the original approval, and writes an `approval_history` event. Security therefore returns `BLOCKED BY GA` rather than accepting the QR token.

## Data safety

On startup, the database uses idempotent additive migrations. Existing users, passes, QR tokens, gate logs, and approvals are retained. New audit fields/tables include `approval_history`, `ga_applications`, block metadata, rejection/reapproval metadata, and `approvalType`.

Demo accounts: `STU001/student123`, `STU002/student123`, `WARDEN01/warden123`, `SEC01/security123`, and `GA001/ga123`.

## Run locally

Requires Node 22.13+.

```bash
npm install
npm start
```

Open `http://localhost:3000`. For hot frontend development run `npm run dev` and open `http://localhost:5173`. After frontend changes, run `npm run build`; this refreshes the production `dist/` that `npm start` serves.

On Windows PowerShell systems with script execution disabled, use `npm.cmd run build`.

## Deployment

Local development uses `data/gatepass.db` via Node's built-in SQLite. Set `TURSO_DATABASE_URL` (or `DATABASE_URL`) and `TURSO_AUTH_TOKEN` to use Turso/libSQL in a hosted backend (Render/Railway). Build the frontend with `npm run build`, deploy `dist` to Vercel or serve it from Express, and configure the frontend's API base URL if it is hosted separately.
