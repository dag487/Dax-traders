# Dax-traders — Clean Vercel starter + Deriv backend connector

This branch provides a minimal, safe reset of the app and a simple server-side
Deriv connector. It purposefully avoids committing secrets and aims to be
re-deployable on Vercel with minimal setup.

What I changed
- Created a small server-side Deriv helper: `lib/deriv-client.ts`
- Added a generic API route: `POST /api/deriv` (app/api/deriv/route.ts) that
  forwards a single JSON request to Deriv and returns the first response.
- Replaced the repository production env file content with an example (no
  real tokens) and added `.env.example`.

Important: no secrets committed
- Do NOT commit DERIV_API_TOKEN or any real tokens.
- Add DERIV_API_TOKEN (server-side) and NEXT_PUBLIC_DERIV_APP_ID (if needed)
  to Vercel Environment Variables before deploying.

How to use the backend connector
1. Set environment variables in Vercel or locally (.env.local):
   - DERIV_API_TOKEN=your_authorize_token_here
   - NEXT_PUBLIC_DERIV_APP_ID=your_app_id_if_you_have_one

2. Call the API route from the server or client (client should call your
   backend endpoint; do not embed DERIV_API_TOKEN in client code):

   POST /api/deriv
   Content-Type: application/json

   Body example (authorize):
   {
     "request": { "authorize": "YOUR_DERIV_TOKEN" }
   }

   Body example (get balance):
   {
     "request": { "get_account_status": 1 }
   }

   Body example (ticks):
   {
     "request": { "ticks": "R_100" }
   }

Notes and limitations
- This connector is intentionally simple: it opens a short-lived WebSocket,
  sends one request, returns the first message, and closes the connection.
- For real-time streaming (ticks, live subscriptions) you should implement a
  persistent WS proxy or handle subscriptions client-side.
- The route runs under the `nodejs` runtime to allow the `ws` package.

If you want, I can next:
- Implement helper client-side hooks (useDeriv) that call `/api/deriv` safely
- Add a small dashboard page that shows balance and a tick sample
- Harden error handling and add request ID correlation for debug logging

