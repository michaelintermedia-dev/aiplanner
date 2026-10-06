# QA toolkit

Used by the `qa-explorer` agent (`.claude/agents/qa-explorer.md`), and handy by hand.
Everything runs against a **separate copy of the API on :58600** and the **QA account**
(`feedtest@test.local`) - never your own account or your running backend.

## One-time setup

```bash
cd tools/qa && npm install
```

Put the dev database connection string in `tools/qa/.local/conn.txt` (gitignored - it
holds the `postgres` password). Find it in the Aspire dashboard (the `aiplannerdb`
resource), or build it: `Host=127.0.0.1;Port=<the postgres container's host port>;Username=postgres;Password=<AppHost secret Parameters:postgres-password>;Database=aiplannerdb`.

Optional: copy `ffmpeg.exe` to `tools/qa/.local/` to test audio compression / pause trimming.

## Use

```powershell
./start-api.ps1        # build + run the QA API on :58600 (leave it running)
node seed.cjs          # reset the QA account and seed varied data (no AI calls)
./say.ps1 -Text "Buy milk and call Anna at 3" -Out out/x.wav   # fake voice
node seed.cjs --reset-only   # clean up at the end
```

The web app must be running on http://localhost:5173 (Aspire, or `npm run dev` in `web/`).
`lib.cjs` has `openApp()` (Chrome, signed in, API routed to :58600), `api()`, `audioForm()`
and an AI budget (`QA_AI_BUDGET`, default 20 OpenAI calls per run - counted in `out/ai-calls.txt`).

Reports go to `docs/qa/<date>-<area>.md`; screenshots to `tools/qa/out/` (gitignored).
