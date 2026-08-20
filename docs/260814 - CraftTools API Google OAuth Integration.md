# CraftTools API — Google OAuth Integration

This document covers the design, implementation details, security model, and
deployment requirements for **Sign in with Google** support in CraftTools API.

It is a companion to the [API DOCUMENTATION.md](../../craftools_api/docs/DOCUMENTATION.md);
familiarity with the general architecture (bootstrap, data model, `api_auth.php`,
`repo.php`) is assumed. See §4 there for the existing security baseline that
this feature builds on.

---

## 1. Overview

`app_users` (CraftTools+ customers) were originally created only by
administrators through the panel or automatically via payment webhooks
(Hotmart/Kiwify). Neither path gave end-users a self-service login.

This integration adds a **passwordless, self-service login** path via Google's
Identity platform. The design goals are:

- No Composer dependency — the JWT verification is implemented in plain PHP
  using PHP's native `json_decode`, `base64_decode`, and `openssl_verify`.
- No server-side OAuth redirect/callback round-trip — the browser completes the
  Google sign-in flow and delivers a signed `id_token` (JWT); the API only
  validates that token and issues its own `api_token` in exchange.
- Fully compatible with the existing `api_tokens` / tier system — a user
  authenticated via Google receives a standard `api_token` and follows the same
  tier-gating rules as any other token holder.
- Progressive: users who already have a token issued by the admin or by a
  webhook are not affected. Google login is an additional path, not a
  replacement.

---

## 2. Authentication Flow

```
Browser / PWA
  │
  ├─ 1. Renders the Google Identity button (GSI library from accounts.google.com)
  ├─ 2. User completes sign-in in a popup — no redirect leaves the app
  ├─ 3. Google delivers a signed id_token (JWT) to the browser callback
  │
  └─ POST /v1/auth/google
        Content-Type: application/json
        { "id_token": "eyJhbGci..." }
        │
        └─ google_auth.php
              │
              ├─ Fetch Google JWKS (cached per-request)
              ├─ Verify JWT signature, iss, aud, exp
              ├─ Extract sub, email, name, picture
              │
              ├─ appUserFindByGoogleSub(sub)  ─── found ──→ use existing record
              │         │
              │       not found
              │         │
              │         └─ appUserFindByEmail(email) ── found ──→ link sub to it
              │                   │
              │                 not found
              │                   │
              │                   └─ appUserCreate (tier=free, provider=google)
              │
              └─ Issue / renew api_token  →  return { api_token, tier, name,
                                              email, avatar_url }
```

The `api_token` returned is a standard 64-hex-character token, stored as a
SHA-256 hash in `api_tokens` — identical in format and security properties to
any other token in the system. The browser stores it and sends it as
`Authorization: Bearer <token>` on every subsequent API call.

---

## 3. Files Changed

### 3.1 `src/google_auth.php` *(new)*

Central module. Loaded by `bootstrap.php` alongside the existing auth modules.

**`googleFetchJwks(): array`**
Fetches Google's public key set from
`https://www.googleapis.com/oauth2/v3/certs` using `file_get_contents` with a
`stream_context`. The result is cached in an in-process static variable for the
lifetime of the request. On production servers that handle many concurrent
requests, an external cache (e.g. APCu) can be layered on top, but the current
implementation is correct without it because JWKS keys rotate slowly (Google
publishes a `Cache-Control: max-age` of several hours).

**`googleVerifyIdToken(string $idToken): array`**
Validates a Google `id_token` without any external library:

1. Splits the JWT into header, payload, and signature parts.
2. Base64url-decodes and JSON-parses the header to extract the key ID (`kid`)
   and algorithm (`alg` — must be `RS256`).
3. Fetches JWKS and locates the matching key by `kid`.
4. Converts the JWK `n`/`e` fields to a PEM-formatted RSA public key using
   `pack`/`base64_encode`.
5. Verifies the signature with `openssl_verify(header.payload, sig, pem, OPENSSL_ALGO_SHA256)`.
6. Validates claims:
   - `iss` must be `accounts.google.com` or `https://accounts.google.com`.
   - `aud` must equal `GOOGLE_CLIENT_ID` from `.env`.
   - `exp` must be in the future (with a ±60 second clock-skew tolerance).
7. Returns the decoded payload array (`sub`, `email`, `email_verified`, `name`,
   `picture`) or throws a `RuntimeException` with a machine-readable error code
   on any failure.

**`googleFindOrCreateUser(array $payload): array`**
Resolves the Google payload to a local `app_user`:

1. Looks up by `google_sub` (most common path for returning users).
2. Falls back to e-mail lookup (handles the case where the account was created
   by a webhook or by an admin before the user ever signed in with Google).
   If found by e-mail, backfills `google_sub` and `avatar_url` on that record.
3. If no existing record, creates a new `app_user` with `tier=free`,
   `status=active`, `auth_provider=google`.
4. Issues or renews an `api_token` for the user (active, no expiry by default)
   using `apiTokenCreate` from `repo.php`.
5. Returns `{ user, raw_token }`.

---

### 3.2 `public/v1/auth/google.php` *(new)*

Single-endpoint file at `POST /v1/auth/google`.

- Accepts `Content-Type: application/json` with a `{ "id_token": "..." }` body
  (or `application/x-www-form-urlencoded` with an `id_token` field).
- Rate-limited using the existing `rateLimitCheck()` infrastructure
  (bucket: `google_auth:<ip>`, 10 attempts / 5 minutes).
- On success responds `200` with:

```json
{
  "status": "success",
  "api_token": "<64-hex-char raw token>",
  "tier": "free",
  "name": "Maria Silva",
  "email": "maria@gmail.com",
  "avatar_url": "https://lh3.googleusercontent.com/..."
}
```

- Error responses follow the existing `/v1/` shape — `{ "status": "error", "message": "..." }`
  with the appropriate HTTP status:

| Code | Reason |
|---|---|
| `400` | Missing or malformed `id_token` field |
| `401` | Invalid JWT signature, wrong `aud`, expired, or unverified e-mail |
| `405` | Non-POST method |
| `429` | Rate limit exceeded |

---

### 3.3 `src/bootstrap.php` *(modified)*

Adds `require_once __DIR__ . '/google_auth.php'` after the existing auth
includes, so the module is available to any entry point that loads bootstrap.

---

### 3.4 `src/db.php` — `ensureAdditiveSchema()` *(modified)*

Adds three columns to `app_users` via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`
(idempotent — safe to run on every request against an already-migrated database):

| Column | Type | Default | Purpose |
|---|---|---|---|
| `google_sub` | `TEXT UNIQUE` | `NULL` | Stable Google user identifier. Indexed for lookup performance. |
| `avatar_url` | `TEXT` | `NULL` | Profile picture URL from Google, refreshed on each sign-in. |
| `auth_provider` | `TEXT` | `'manual'` | Origin of the account: `manual`, `google`, or `webhook`. |

---

### 3.5 `database/schema.sql` *(modified)*

The three columns above are also added to the `app_users` `CREATE TABLE`
statement so fresh installations include them from the start. Existing
installations pick them up via `ensureAdditiveSchema()`.

---

### 3.6 `.env.example` *(modified)*

```
# ── Google OAuth ──────────────────────────────────────────────────────────────
# Client ID from Google Cloud Console (APIs & Services → Credentials → OAuth 2.0
# Client IDs → Web application). Required for POST /v1/auth/google.
# The Client Secret is NOT needed — this endpoint uses the id_token flow only.
GOOGLE_CLIENT_ID=
```

---

## 4. Google Cloud Console Setup

Before the endpoint can validate tokens, a Google Cloud project with an OAuth
2.0 Web Client ID must be created:

1. Go to [console.cloud.google.com](https://console.cloud.google.com) and
   select or create a project.
2. Navigate to **APIs & Services → OAuth consent screen**. Choose **External**
   (unless the application is restricted to a Google Workspace organisation).
   Fill in the required fields (app name, support e-mail, developer e-mail) and
   add the scope `openid email profile`. Save and continue.
3. Navigate to **APIs & Services → Credentials → Create Credentials →
   OAuth 2.0 Client ID**. Choose type **Web application**.
4. Under **Authorized JavaScript origins**, add every origin from which the
   PWA will call `google.accounts.id.initialize` — e.g.
   `https://app.crafttool.studio`.
5. **Authorized redirect URIs** — leave empty. This integration uses the
   One Tap / popup flow, which does not redirect.
6. Copy the generated **Client ID** (ends in `.apps.googleusercontent.com`)
   into `.env` as `GOOGLE_CLIENT_ID`.
7. The **Client Secret** is not used and must never be exposed to the browser
   or committed to version control.

---

## 5. Front-End Integration

The API side is front-end-agnostic. A minimal PWA integration with the
Google Identity Services library:

```html
<!-- In <head> -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

```javascript
google.accounts.id.initialize({
  client_id: 'YOUR_CLIENT_ID.apps.googleusercontent.com',
  callback: async ({ credential }) => {
    const res = await fetch('/v1/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_token: credential }),
    });
    const data = await res.json();
    if (data.status === 'success') {
      // Store and reuse as Authorization: Bearer on subsequent calls.
      localStorage.setItem('api_token', data.api_token);
    }
  },
});

google.accounts.id.renderButton(
  document.getElementById('google-signin-btn'),
  { theme: 'outline', size: 'large' }
);
```

`credential` is the `id_token` JWT. Everything else is handled by the API.

---

## 6. Security Considerations

**Additions on top of the existing security baseline:**

- **No password storage for Google users** — accounts created via this flow
  never have a `password_hash`; authentication is fully delegated to Google.
- **JWT signature verification** — every `id_token` is verified against
  Google's current public keys before any user lookup or creation occurs.
- **`aud` claim enforcement** — the token must have been issued specifically
  for this application's Client ID; tokens from other Google apps are rejected.
- **`exp` enforcement** — Google `id_token`s expire within one hour of issuance.
  Replaying a captured token after expiry is rejected.
- **`google_sub` as primary lookup key, not e-mail** — Google's `sub` claim is
  immutable per user, even if the user changes their e-mail address. Looking up
  by `sub` first prevents account-takeover via e-mail reuse.
- **Rate limiting on the auth endpoint** — 10 requests / IP / 5 minutes.
- **Tier starts at `free`** — newly self-registered users cannot access `plus`
  or `premium` resources until a payment webhook promotes their tier.

**Known limitations / future work:**

- The JWKS fetch uses `file_get_contents` with `allow_url_fopen`. On hosts
  where that is disabled, the fetch will fail. A `cURL` fallback should be
  added if this becomes an issue.
- JWKS keys are cached only for the duration of the current PHP request. On
  high-traffic deployments, caching via APCu with the JWKS `e-tag` or a
  fixed TTL of 1–6 hours would reduce outbound HTTP calls.
- There is currently no `POST /v1/auth/google/unlink` endpoint to detach a
  Google account from a local user. Unlinking must be done by an administrator
  through the panel until such an endpoint is added.

---

## 7. Environment Variables Summary

| Variable | Required | Purpose |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Yes | OAuth 2.0 Client ID from Google Cloud Console. Used to validate the `aud` claim of every `id_token`. |

All other variables listed in
[DOCUMENTATION.md §7](../../craftools_api/docs/DOCUMENTATION.md#7-installation--deployment)
remain unchanged.
