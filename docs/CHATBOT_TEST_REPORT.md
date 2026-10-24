# Chatbot test report

On 2026-10-24, `npm test` passed 75/75 after adding the server-side FAQ matching integration. Focused core/chat/server tests passed 25/25. Coverage includes deterministic answer preservation, eligible-only FAQ selection, no-answer fallback, boolean environment parsing, safe API error mapping, and static-build exclusion of backend/environment files.

The configured API project returned HTTP 200 from `GET /v1/models`; the configured display phrase was unavailable, while `gpt-4.1-mini` was listed for the project. One synthetic paraphrase was then sent through the local UI and matched to the exact approved Profile Agent answer. A synthetic unrelated question returned the no-confident-match fallback. No uploaded file or customer data was used. Browser Console inspection and production deployment remain unverified.
