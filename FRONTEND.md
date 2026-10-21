# React semantic analytics workspace

The React client implements the MCP consumption workflow: ask a question, inspect
results and provenance together, save the server-issued resolution, and rerun it
without a resolver LLM call. It is an optional client surface; ingestion,
semantic-model authoring and governance remain outside this implementation.

## Run on Windows

Use Python 3.12 for the locally verified backend and Node.js 22+ with pnpm 11.
Run from this repository root, not the tuning-fork repository.

```powershell
py -3.12 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements-mcp.txt
python scripts/prepare_tokenizer.py
python scripts/seed_demo.py
```

In frontend/, install and build:

```powershell
cd frontend
pnpm install --frozen-lockfile
pnpm build
cd ..
python -m uvicorn main_mcp_react:create_app --factory --host 127.0.0.1 --port 8000
```

Open http://127.0.0.1:8000/. Select Connect service and enter local-demo-token.
The default is fixture interpretation with synthetic DuckDB data. Choose a sample
question and Ask. The all-time interaction count is Call 4, Chat 3, Email 1.
No LLM credentials or tuning-fork settings are needed for this mode.

If settings from another test are active, set MCP_RESOLVER_MODE=fixture and
MCP_EXECUTION_MODE=demo before launching. The application reads MCP_-prefixed
settings from .env and the environment; environment values take precedence.

## Development with hot reload

Start the same Python backend on port 8000. In another terminal:

```powershell
cd frontend
pnpm dev
```

Open http://127.0.0.1:5173/. Vite proxies /analytics and /ui-config to the backend.
The actual MCP request still uses the backend's transport/authentication checks.
Configure MCP_ALLOWED_ORIGINS/MCP_ALLOWED_HOSTS for your trusted deployment when
using other hostnames. Built assets use same-origin requests with no public
provider keys or external frontend services.

## Workflow and PRD mapping

| Requirement | Client implementation |
| --- | --- |
| Two tools only | MCP initialize, discovery, ask_question and save_query |
| Question close to verbatim | Composer text is sent unchanged to ask_question |
| Provenance next to results | Model owners, defaults, filters, dates, caveats and execution details remain beside table/chart |
| No silent variant choice | cannot_answer displays server candidates; selecting one starts a new independent question |
| Saved dashboard rerun | POST saved-query REST endpoint; no resolver LLM request from the client |
| Stored interpretation/spec | Retrieve by server ID through GET saved-query REST endpoint |
| Shared response contract | answered, cannot_answer and error have distinct states |
| Limits | Truncation warning and null-value disclosure |
| Authenticated consumers | Bearer token attached to MCP and saved-query calls |

The UI offers table/chart switching and CSV export, as a client responsibility.
Percent fractions are formatted as percentages; high-precision non-percent decimal
strings remain intact in tables. CSV exports raw values. Leading spreadsheet
formula characters are escaped. Chart bars show magnitude, with negative values
marked; chart values are visual approximations of numeric data.

Session history and the session saved-query list are kept in memory only. The
server has no list-saved-queries endpoint, so this UI does not pretend to provide
a complete server-side library. Use Open a saved query with its ID after a refresh.
Saved definitions persist on the backend. A saved rerun has no new saveable
resolution; ask again to create a new one.

Tokens, questions and answers are not written to localStorage/sessionStorage.
Changing authenticated identity or disconnecting clears page history and results.
There are no LLM API credentials in React. The runtime /ui-config response exposes
only sample question texts, modes, model name and MCP prefix.

## Architecture and files

```text
React client (browser)
  ├─ /ui-config: public sample questions and runtime mode
  ├─ /analytics/mcp: authenticated JSON Streamable HTTP
  │    ├─ initialize → notifications/initialized → tools/list
  │    ├─ tools/call ask_question
  │    └─ tools/call save_query
  └─ /analytics/api/v1/saved-queries/{id}: authenticated GET / POST run
             ↓
  Existing resolver → validator → MetricFlow → executor → rows + provenance
```

| File | Purpose |
| --- | --- |
| frontend/src/App.tsx | Workspace, connection/save dialogs, charts, provenance and saved-query views |
| frontend/src/api.ts | Typed response contract, authenticated protocol client and value formatting |
| frontend/src/styles.css | Responsive desktop/mobile presentation |
| frontend/src/api.test.ts | Protocol sequencing, authentication, ambiguity and formatting tests |
| frontend/vite.config.ts | Build configuration and development proxy |
| main_mcp_react.py | Isolated FastAPI entry point with existing MCP service |
| semantic_mcp/react_ui.py | Built frontend hosting and public runtime configuration |
| tests/test_react_ui.py | Static-host/authentication and unbuilt-client checks |

The existing Python demo page and entry points are retained for compatibility.
Use main_mcp_react for the React version. A missing frontend build gives clear
build instructions rather than silently falling back to the old Python UI.

## LLM and live execution

Set MCP_RESOLVER_MODE=llm and the approved MCP_LLM_BASE_URL, MCP_LLM_API_KEY,
MCP_LLM_MODEL fields to test real interpretation while keeping
MCP_EXECUTION_MODE=demo. The backend, not React, calls the provider.
This server repository's provider contract is Chat Completions + bearer auth +
strict structured output. Azure-specific fixes in the separate Serv repository
are deliberately not copied into this frontend change.

Live warehouse execution requires a supported enterprise model, read-only
warehouse settings and validation. The UI labels actual execution mode rather
than inferring it from the SQL dialect: a Snowflake binding in demo mode is still
executed on local DuckDB.

## Tuning-fork integration

Build frontend/dist and copy it with the source package into the host checkout.
Keep the existing install_mcp(app). Call install_react_ui on the host after its
existing routes and the MCP mount. Pass the model name/settings and approved
example questions. The default installer mounts the client at /; if the host
already serves a root frontend, integrate this React source into that application
instead of installing a second catch-all mount. No host source or migrations are
modified by this repository automatically.

## Tests

```powershell
cd frontend
pnpm test
pnpm build
cd ..
python -m pip install -e '.[dev]'
python -m pytest -q
```

Run browser checks after starting the server: connect, ask, switch chart/table,
save, open saved queries, rerun, inspect zero LLM calls, and ask an ambiguous
question. Test a wrong token and a narrow viewport as well. Tests do not replace
enterprise result reconciliation or real client/warehouse acceptance testing.
