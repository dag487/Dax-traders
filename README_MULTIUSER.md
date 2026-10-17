# Multi-user & Insights

This branch adds basic multi-user support and a simple insights endpoint.

New endpoints

- POST /api/users
  - Create a user: { "username": "alice", "deriv_token": "OPTIONAL_TOKEN" }
  - Returns: { user: {id,username,createdAt}, token: <JWT> }

- GET /api/users/me
  - Auth: Authorization: Bearer <JWT>
  - Returns current user (no secrets)

- POST /api/users/me/token
  - Auth: Authorization: Bearer <JWT>
  - Body: { "deriv_token": "..." }
  - Stores the user's Deriv token encrypted on disk (data/users.json) using USER_STORE_KEY

- GET /api/insights
  - Auth: Authorization: Bearer <JWT>
  - Returns: authorization response and get_account_status results combined

Important notes
- Persistence: this implementation stores users in data/users.json on disk and encrypts tokens with USER_STORE_KEY. On serverless platforms (Vercel) the filesystem is ephemeral — use a proper database (Postgres, Supabase, or Vercel KV) for production.
- Environment variables required:
  - JWT_SECRET — used to sign authentication JWTs
  - USER_STORE_KEY — used to encrypt stored Deriv tokens (must be kept secret)
  - DERIV_API_TOKEN (optional) — used in other endpoints if set
  - NEXT_PUBLIC_DERIV_APP_ID (optional)

Security
- Do NOT commit real tokens — the users.json file is gitignored and will not be committed.
- Provide USER_STORE_KEY and JWT_SECRET in Vercel Environment Variables before creating users.

