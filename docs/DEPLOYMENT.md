# Static deployment

The browser UI remains static HTML/CSS/JavaScript. Build with `npm run build`; publish `dist/`. For Vercel use Root Directory at the repository project root, Framework Preset **Other**, Build Command `npm run build`, and Output Directory `dist`. No SPA rewrite is needed. The build publishes the pages, aliases, assets, and approved Q&A entries whose entry status is not held, rejected, or under review; it never publishes `.env` or backend code.

`npm run dev` starts a local Node server that serves `dist/` and the same-origin `/api/match` endpoint. The current Vercel static deployment does not provide that endpoint, so optional AI matching is local-development only until a compatible server/API deployment is configured. Never add `OPENAI_API_KEY` to Vercel static build variables or browser code. The CLI orchestrator remains local. Production deployment is unverified.
