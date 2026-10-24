# Local development

No dependencies need to be installed. From the project root, run:

```sh
npm run dev
```

This command builds the static site into `dist/` and starts the Node server on loopback. The server reads `.env` from the project root, serves static output, and exposes the same-origin `/api/match` endpoint. Keep the terminal running, then visit `http://127.0.0.1:8000/` for the AI Orchestration presentation or `http://127.0.0.1:8000/demo.html` for the functional demo. Do not open the project folder or HTML files through Finder/`file://`.

The optional chatbot matching integration is enabled only when `ENABLE_AI_MATCHING=true`, an `OPENAI_API_KEY` is configured, and `OPENAI_MODEL` is a valid model ID. `.env.example` contains placeholders; copy it to `.env` only when you do not already have a local `.env`. Do not commit or share `.env`. Deterministic FAQ matching runs first. For unmatched chat questions, the server sends only the question and the eligible approved FAQ candidate metadata to OpenAI for classification. The backend returns an answer only by looking up a selected eligible FAQ ID in the local approved file. Uploaded files and answer text are never sent to the model. When AI is disabled or unavailable, the chat keeps its approved fallback.

To stop the server, press Ctrl+C in its terminal. Run tests separately with `npm test`.

Run `npm run demo:orchestration` for the synthetic local pipeline. Outputs are written under ignored `runs/`. The actual run ID is printed. Never use real customer data as a committed fixture.
