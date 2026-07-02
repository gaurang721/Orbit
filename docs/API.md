# API reference (Phase 1: Auth)

Base URL: `http://localhost:4000/api/v1` · Interactive docs: `http://localhost:4000/api/docs`
(OpenAPI JSON at `/api/docs.json`).

## Response envelope

```jsonc
// success
{ "success": true, "data": { ... }, "message": "optional human text" }
// error
{ "success": false, "error": { "code": "STRING_CODE", "message": "...", "details": { "field": ["msg"] } } }
```

Common error codes: `VALIDATION_ERROR` (422), `UNAUTHORIZED` (401), `TOKEN_EXPIRED` (401),
`FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `TOO_MANY_REQUESTS` (429).

## Auth header & cookie

- Authenticated requests send `Authorization: Bearer <accessToken>`.
- The refresh token is delivered as an **httpOnly cookie** scoped to `/api/v1/auth`; send
  cookies with `--cookie-jar`/`credentials: 'include'`.

## Examples

### Register

```bash
curl -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' -c cookies.txt \
  -d '{"firstName":"Ada","lastName":"Lovelace","username":"ada","email":"ada@example.com","password":"Password123"}'
```

```jsonc
// 201
{ "success": true,
  "data": { "user": { "id": "…", "username": "ada", "emailVerified": false, … },
            "accessToken": "eyJ…", "expiresIn": 900 },
  "message": "Account created. Check your email to verify your address." }
```

### Login

```bash
curl -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' -c cookies.txt \
  -d '{"identifier":"ada","password":"Password123","rememberMe":true}'
```

If 2FA is enabled the response is a challenge instead of tokens:

```jsonc
{ "success": true, "data": { "twoFactorRequired": true, "challengeToken": "eyJ…" } }
```

…then complete it:

```bash
curl -X POST http://localhost:4000/api/v1/auth/login/2fa \
  -H 'Content-Type: application/json' -c cookies.txt \
  -d '{"challengeToken":"eyJ…","code":"123456"}'
```

### Refresh (rotates the refresh token)

```bash
curl -X POST http://localhost:4000/api/v1/auth/refresh -b cookies.txt -c cookies.txt
# → { success: true, data: { user, accessToken, expiresIn } }
```

### Authenticated request

```bash
curl http://localhost:4000/api/v1/auth/me -H "Authorization: Bearer $ACCESS_TOKEN"
```

### Password reset

```bash
curl -X POST .../auth/forgot-password -d '{"email":"ada@example.com"}' -H 'Content-Type: application/json'
# (link is emailed; in dev it is printed to the API logs)
curl -X POST .../auth/reset-password  -d '{"token":"<from-link>","password":"NewPassword123"}' -H 'Content-Type: application/json'
```

### Two-factor setup

```bash
curl -X POST .../auth/2fa/setup  -H "Authorization: Bearer $ACCESS_TOKEN"
#   → { secret, otpauthUrl, qrDataUrl }   (render qrDataUrl as an <img>)
curl -X POST .../auth/2fa/enable -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H 'Content-Type: application/json' -d '{"code":"123456"}'
#   → { backupCodes: [ … ] }   (shown once)
```

### Sessions

```bash
curl       .../auth/sessions      -H "Authorization: Bearer $ACCESS_TOKEN"   # list devices
curl -X DELETE .../auth/sessions/<id> -H "Authorization: Bearer $ACCESS_TOKEN"  # revoke one
```

## Full endpoint list

| Method | Path                       | Auth | Purpose                          |
| ------ | -------------------------- | ---- | -------------------------------- |
| POST   | `/auth/register`           | —    | Create account (auto-login)      |
| POST   | `/auth/login`              | —    | Login (may return 2FA challenge) |
| POST   | `/auth/login/2fa`          | —    | Complete 2FA login               |
| POST   | `/auth/refresh`            | cookie | Rotate refresh, new access     |
| POST   | `/auth/logout`             | cookie | Revoke current session         |
| POST   | `/auth/logout-all`         | ✔    | Revoke all sessions              |
| GET    | `/auth/me`                 | ✔    | Current user                     |
| POST   | `/auth/change-password`    | ✔    | Change password                  |
| POST   | `/auth/verify-email`       | —    | Verify email via token           |
| POST   | `/auth/resend-verification`| —    | Resend verification email        |
| POST   | `/auth/forgot-password`    | —    | Request reset email              |
| POST   | `/auth/reset-password`     | —    | Reset password via token         |
| POST   | `/auth/2fa/setup`          | ✔    | Begin 2FA setup (QR/secret)      |
| POST   | `/auth/2fa/enable`         | ✔    | Enable 2FA (verify code)         |
| POST   | `/auth/2fa/disable`        | ✔    | Disable 2FA (password)           |
| GET    | `/auth/sessions`           | ✔    | List active sessions             |
| DELETE | `/auth/sessions/:id`       | ✔    | Revoke a session                 |
| GET    | `/health`                  | —    | Liveness probe                   |
