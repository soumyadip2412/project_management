# Security checklist: Project Camp production deploy

Work through it top to bottom.
- **Part A** items must be done or fixed before going live.
- **Part B** items you set yourself in the Atlas, Render and Vercel dashboards.
- **Part C** lists protections already in the code, so you can explain them to a client.
- **Part D** is the post-deploy test.
- **Part E** is ongoing operation.

## A. Must be fixed in the code before deploy

- [ ] **Auth rate limiter scope.** `authLimiter`, at 20 requests per 15 minutes per IP, is mounted on all of `/api/v1/auth`, so it also counts `GET /current-user`, `/refresh-token` and `/logout`. Every page load calls `current-user`. A few people on one office network or Wi-Fi share one IP, so they would get "Too many authentication attempts" during a demo. **Fix:** apply the strict limiter only to `POST /login`, `POST /register`, `POST /forgot-password`, `POST /reset-password/:token`, `GET /check-email` and `POST /resend-email-verification`. Keep everything else under the global limiter.
- [ ] **Security headers on the Vercel app.** The API sends `nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, a CSP on `/api/*` and HSTS in production. The static app served by Vercel sends none of these. **Fix:** add a `headers` block to `frontend/vercel.json` with:
  - a Content-Security-Policy: scripts from `'self'` plus the hash of the inline theme script in `index.html`, Google Fonts allowed, `connect-src 'self'`, `frame-ancestors 'none'`;
  - `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and `X-Frame-Options`.
- [ ] **Swagger UI in production.** `/api-docs` publishes the full API map. **Fix:** serve it only when `NODE_ENV !== "production"` or when `ENABLE_API_DOCS=true` is set.
- [ ] **`npm audit` = 0** in `backend/` (done 2026-10-24; re-check right before deploy).

## B. Configure in the dashboards (you)

**MongoDB Atlas**
- [ ] Use a dedicated database user for the app, with **readWrite on the one database only** (not Atlas admin).
- [ ] Use a long, generated password for that user. If it contains special characters, URL-encode it in `MONGO_URL`.
- [ ] Network Access: `0.0.0.0/0` is needed for Render's free plan, which has no fixed IP. Credentials are then the only gate, so keep them strong and secret. On a paid Render plan with static outbound IPs, restrict access to those IPs.
- [ ] Use a separate database name for production (e.g. `/projectcamp`), not the dev database `projmanage`.
- [ ] Never run `npm run seed` against Atlas. It **wipes users and projects**. Only `npm run seed:demo` is safe.
- [ ] Backups: the free M0 tier has no automated backups. Export the data periodically (`mongodump`), or move to a paid tier before real clients rely on it.

**Render (API)**
- [ ] `NODE_ENV=production`, so the startup checks enforce secrets, `MONGO_URL` and `CORS_ORIGIN`.
- [ ] `ACCESS_TOKEN_SECRET` and `REFRESH_TOKEN_SECRET` are **different** and **≥ 32 characters**. The Blueprint generates them. Never reuse your local `.env` values.
- [ ] `CORS_ORIGIN` = your exact Vercel URL (`https://…vercel.app`), with no trailing slash and no `*`.
- [ ] `TRUST_PROXY=2`, because requests pass through Vercel and then Render. A wrong value either lets clients spoof IPs or puts every user in one rate-limit bucket.
- [ ] `FORGOT_PASSWORD_REDIRECT_URL` and `EMAIL_VERIFICATION_REDIRECT_URL` point at the Vercel domain, so emailed links never point at localhost.
- [ ] If email is enabled: the SMTP credentials belong to a transactional provider, and the sending domain has SPF/DKIM set up.
- [ ] Health check path `/api/v1/healthcheck/ready` (returns 503 when the database is down).
- [ ] Only you have access to the Render account. Turn on 2FA.

**Vercel (app)**
- [ ] Root Directory is `frontend`. No secrets in Vercel environment variables: the app needs none, and everything prefixed `VITE_` is public by design.
- [ ] The rewrite destination in `vercel.json` matches the real Render URL.
- [ ] Turn on 2FA. Only add a custom domain you control, and update `CORS_ORIGIN` and the redirect URLs when you add one.

**GitHub**
- [ ] No `.env` with real values is committed. Only `.env.sample`, `.env.e2e` and `.env.production`, which hold no secrets, are tracked. Checked 2026-10-24.
- [ ] Turn on 2FA and branch protection on `main`, and enable Dependabot alerts.

## C. Already built in (no action; know it for client questions)

- **Sessions**
  - Cookie-only: `httpOnly`, `Secure` and `SameSite` set in production, so tokens never reach JavaScript or `localStorage`.
  - Short-lived access token (15 min); refresh token (7 d) sent only to `/api/v1/auth`.
  - The refresh token is stored only as a SHA-256 hash, rotated on every use, with reuse detection that revokes all sessions.
  - Logout, password change or reset, deactivation and role change revoke every issued token (`tokenVersion`).
- **Passwords:** bcrypt. Reset and verification tokens are stored hashed, expire, and work only once. Login gives the same message for an unknown email and a wrong password.
- **Authorization:** checked on the server for every request through one permission matrix that fails closed. Membership is required per project and workspace. Child records are always queried with their parent, so another user's ids return 404. Multi-user attack tests cover this in `backend/tests/api/authorization.test.js`.
- **Input:** every field is type-checked (blocks `{"$ne": null}`-style NoSQL injection), search text is regex-escaped, pagination is clamped, and JSON bodies are limited to 32 kB.
- **CSRF:** unsafe requests from a non-allow-listed `Origin` get a 403.
- **Rate limiting:** a global limiter plus the auth limiter, and the counters can be shared through `REDIS_URL`.
- **Errors:** responses never include stack traces in production, and every error carries a `requestId` for log lookup.
- **Audit log:** every successful change records who, what and when, and the log survives project deletion (kept 365 days).

## D. After deploy: verify (10 minutes)

- [ ] `https://<render>/api/v1/healthcheck/ready` → 200.
- [ ] Open the Vercel URL. In devtools → Network, every request goes to the Vercel domain, none to `onrender.com`.
- [ ] Sign in. In devtools → Application → Cookies, `accessToken` and `refreshToken` show **HttpOnly ✓, Secure ✓**. In the Console, `document.cookie` does not show them.
- [ ] Reload a deep link such as `/dashboard/projects/<id>/board`. It loads with no 404.
- [ ] Sign out, then press Back. Protected pages redirect to `/login`.
- [ ] Sign in as `kavya@demo.dev` (viewer) and try to move a card. It is refused (403) and snaps back.
- [ ] From another site's console, `fetch("https://<vercel>/api/v1/projects", {method:"POST", credentials:"include"})` is blocked: 403 "Cross-site request rejected", or a CORS error.
- [ ] Response headers on the Vercel page show the CSP and `X-Frame-Options` from Part A, and API responses show HSTS.
- [ ] Ten fast wrong-password logins give a 429 on the login route, while normal browsing keeps working (the Part A limiter fix).

## E. Ongoing

- [ ] Run `npm audit --omit=dev` in `backend/` and `npm audit` in `frontend/` monthly, and before each release.
- [ ] Rotate both token secrets if they ever leak. Changing them signs every user out, which is expected.
- [ ] Look at Render logs for repeated 401, 403 and 429 responses from one IP.
- [ ] Remove or deactivate demo accounts before onboarding real clients, or keep the demo on a separate deployment.
