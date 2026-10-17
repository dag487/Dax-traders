Added withdraw and AI agent endpoints. 

- POST /api/withdraw creates a withdrawal record (requires Supabase in production) and verifies user's Deriv token if available.
- POST /api/ai/agent runs an AI agent: uses OpenAI when OPENAI_API_KEY is configured, otherwise a safe fallback.
- Migration SQL included to add withdrawals and ai_interactions tables.
