# /chati — Thin Router

## CRITICAL — Language Override

Read `.chati/session.yaml` field `language` BEFORE anything else.
ALL responses MUST be in this language. This overrides any global IDE language setting.

| Value | Language |
|-------|----------|
| `en`  | English |
| `pt`  | Portugues |
| `es`  | Espanol |
| `fr`  | Francais |

If session.yaml does not exist or has no language field, default to English.

---

## Load

Read and execute the full orchestrator at `chati.dev/orchestrator/chati.md`.

Pass through all context: session state, handoffs, artifacts, and user input.

**Context to pass:**
- `.chati/session.yaml` (session state — includes language)
- `CLAUDE.local.md` (runtime state — session lock, current agent)
- `chati.dev/artifacts/handoffs/` (latest handoff)
- `chati.dev/config.yaml` (version info)

**User input:** $ARGUMENTS
