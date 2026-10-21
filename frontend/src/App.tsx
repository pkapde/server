import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  McpClient,
  displayValue,
  type Answer,
  type Column,
  type RuntimeConfig,
} from "./api";

type Entry = {
  id: number;
  question: string;
  answer: Answer;
  at: string;
  saved?: boolean;
};
type Saved = { id: string; name: string; question: string };
function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, ReactNode> = {
    spark: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z" />
        <path d="M21 3v4M19 5h4" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    save: (
      <>
        <path d="M6 3h12v18l-6-4-6 4Z" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-6-6 6 6-6 6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    link: (
      <>
        <path d="m10 14 4-4m-6 6-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0m0 12a4 4 0 0 0 6 0l5-5a4 4 0 0 0-6-6l-1 1" />
      </>
    ),
    settings: (
      <>
        <path d="M4 6h16M4 12h16M4 18h16" />
        <circle cx="8" cy="6" r="2" />
        <circle cx="16" cy="12" r="2" />
        <circle cx="10" cy="18" r="2" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    table: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M3 10h18M9 10v10" />
      </>
    ),
    chart: (
      <>
        <path d="M4 4v16h16M8 16v-5m5 5V7m5 9v-7" />
      </>
    ),
    download: (
      <>
        <path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    database: (
      <>
        <ellipse cx="12" cy="5" rx="8" ry="3" />
        <path d="M4 5v14c0 4 16 4 16 0V5M4 12c0 4 16 4 16 0" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6m0-11v1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name] || paths.info}
    </svg>
  );
}
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const json = (value: unknown) => JSON.stringify(value, null, 2);
function downloadCsv(answer: Answer) {
  const cell = (value: unknown) => {
    let text = value === null ? "" : String(value);
    if (/^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const text = [answer.columns.map((c) => c.name), ...answer.rows]
    .map((row) => row.map(cell).join(","))
    .join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "cx-analysis.csv";
  anchor.click();
  URL.revokeObjectURL(url);
}

function Provenance({ answer }: { answer: Answer }) {
  const p = answer.provenance || {};
  return (
    <aside className="provenance card">
      <div className="section-title">
        <span className="icon-tile small">
          <Icon name="shield" />
        </span>
        <div>
          <h3>Behind the answer</h3>
          <p>The definitions and choices used.</p>
        </div>
      </div>
      <div className="proof-item">
        <span className="eyebrow">GOVERNED METRICS</span>
        {p.metrics?.map((metric: any) => (
          <div key={metric.name}>
            <strong>{metric.label || metric.name}</strong>
            <p>Owner · {metric.owner || "Not supplied"}</p>
          </div>
        )) || <p>Not supplied</p>}
      </div>
      <div className="proof-item">
        <span className="eyebrow">TIME RANGE</span>
        <strong>
          {p.time_range?.start
            ? `${p.time_range.start} → ${p.time_range.end}`
            : "All available time"}
        </strong>
        <p>{label(p.time_range?.calendar || "Not supplied")}</p>
      </div>
      <div className="proof-item">
        <span className="eyebrow">CHOICES & DEFAULTS</span>
        {p.metric_choices?.map((choice: any) => (
          <p key={choice.metric}>
            <span className="mini-tag">{choice.basis}</span>{" "}
            {label(choice.metric)}
            {choice.evidence && ` · ${choice.evidence}`}
          </p>
        ))}
        {p.defaults_applied?.map((d: any) => (
          <p key={d.variant_group}>
            Default: {label(d.chosen)} · {d.reason}
          </p>
        ))}
        {!p.metric_choices?.length && <p>No choices reported.</p>}
      </div>
      <div className="proof-item">
        <span className="eyebrow">APPLIED FILTERS</span>
        {p.filters_applied?.length ? (
          p.filters_applied.map((f: any, i: number) => (
            <div className="filter" key={i}>
              <code>
                {f.dimension} {f.operator} {json(f.values)}
              </code>
              <small>{f.source}</small>
            </div>
          ))
        ) : (
          <p>No filters reported.</p>
        )}
      </div>
      <div className="proof-item">
        <span className="eyebrow">SOURCE & EXECUTION</span>
        <strong>
          {p.execution_mode === "demo"
            ? "DuckDB · synthetic data"
            : label(p.warehouse || "Unknown")}
        </strong>
        <p>SQL target · {label(p.warehouse || "Unknown")}</p>
        {p.source_bindings?.map((b: string) => (
          <code className="binding" key={b}>
            {b}
          </code>
        ))}
        <p>
          Resolver · {p.resolver_mode || "Unknown"} · {p.llm_calls ?? "—"} LLM
          calls
        </p>
        {p.executed_at && <p>{new Date(p.executed_at).toLocaleString()}</p>}
      </div>
      {p.caveats?.length > 0 && (
        <div className="caveat">
          <Icon name="info" />
          <div>
            <strong>Source caveats</strong>
            {p.caveats.map((c: any, i: number) => (
              <p key={i}>
                {c.text}
                <small>Review / expiry: {c.expires}</small>
              </p>
            ))}
          </div>
        </div>
      )}
      <details>
        <summary>Technical provenance</summary>
        <pre>
          {json({
            model_file_hash: p.model_file_hash,
            sql_hash: p.sql_hash,
            warehouse_query_id: p.warehouse_query_id,
            request_id: answer.request_id,
          })}
        </pre>
      </details>
    </aside>
  );
}

function Chart({ answer }: { answer: Answer }) {
  const metrics = answer.columns.filter((c) => c.role === "metric");
  const [selected, setSelected] = useState(metrics[0]?.name || "");
  const metric = metrics.find((c) => c.name === selected) || metrics[0];
  const index = answer.columns.findIndex((c) => c.name === metric?.name);
  const dimensions = answer.columns
    .map((c, i) => (c.role === "dimension" ? i : -1))
    .filter((i) => i >= 0);
  const rows = answer.rows.slice(0, 30);
  const max = Math.max(
    0,
    ...rows
      .map((row) => (row[index] === null ? 0 : Math.abs(Number(row[index]))))
      .filter(Number.isFinite),
  );
  if (!metric) return <p>No metric available to chart.</p>;
  return (
    <div className="chart">
      <label className="chart-select">
        Metric
        <select
          value={metric.name}
          onChange={(e) => setSelected(e.target.value)}
        >
          {metrics.map((c) => (
            <option key={c.name} value={c.name}>
              {label(c.name)}
            </option>
          ))}
        </select>
      </label>
      {rows.map((row, i) => (
        <div className="bar-row" key={i}>
          <span>
            {dimensions.length
              ? dimensions.map((i) => String(row[i] ?? "Unknown")).join(" · ")
              : "Total"}
          </span>
          <div className="bar-track">
            <div
              className={"bar " + (Number(row[index]) < 0 ? "negative" : "")}
              style={{
                width: `${row[index] === null || !max ? 0 : (Math.abs(Number(row[index])) / max) * 100}%`,
              }}
              title={displayValue(row[index], metric)}
            />
          </div>
          <strong>{displayValue(row[index], metric)}</strong>
        </div>
      ))}
      <p className="muted">
        {metric.unit === "percent"
          ? "Percentages are formatted from fractional values. "
          : ""}
        Bar length shows magnitude; negative values are marked in coral. Nulls
        appear as —.{answer.rows.length > 30 && " Showing the first 30 rows."}
      </p>
    </div>
  );
}

export default function App() {
  const [config, setConfig] = useState<RuntimeConfig>();
  const [configError, setConfigError] = useState("");
  const [view, setView] = useState("workspace");
  const [question, setQuestion] = useState("");
  const [history, setHistory] = useState<Entry[]>([]);
  const [entry, setEntry] = useState<Entry>();
  const [saved, setSaved] = useState<Saved[]>([]);
  const [savedId, setSavedId] = useState("");
  const [savedDetails, setSavedDetails] = useState<any>();
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [token, setToken] = useState("");
  const [connected, setConnected] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [resultView, setResultView] = useState("table");
  const client = useRef<McpClient | undefined>(undefined);
  const tokenUsed = useRef("");
  const id = useRef(0);
  const gate = useRef(false);
  useEffect(() => {
    if (!connectOpen && !saveOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const handle = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !gate.current) {
        setConnectOpen(false);
        setSaveOpen(false);
      }
      if (e.key === "Tab") {
        const elements = Array.from(
          document.querySelectorAll<HTMLElement>(
            '[role="dialog"] button:not(:disabled), [role="dialog"] input:not(:disabled)',
          ),
        );
        if (!elements.length) return;
        const first = elements[0],
          last = elements[elements.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", handle);
    return () => {
      document.removeEventListener("keydown", handle);
      previous?.focus();
    };
  }, [connectOpen, saveOpen]);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/ui-config", { signal: controller.signal })
      .then((r) => {
        if (!r.ok)
          throw Error(
            "Could not load workspace configuration. Start main_mcp_react.",
          );
        return r.json();
      })
      .then((value) => {
        setConfig(value);
        setQuestion(
          value.questions.find(
            (q: string) => q === "How many total interactions by channel?",
          ) ||
            value.questions[0] ||
            "",
        );
      })
      .catch((e) => {
        if (e.name !== "AbortError") setConfigError(e.message);
      });
    return () => controller.abort();
  }, []);
  async function perform(label: string, action: () => Promise<void>) {
    if (gate.current) return;
    gate.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      gate.current = false;
      setBusy("");
    }
  }
  function activeClient() {
    if (!client.current || !connected) {
      setConnectOpen(true);
      throw Error("Connect to the query service before continuing.");
    }
    return client.current;
  }
  async function connect() {
    if (!config || !token.trim()) throw Error("Enter your bearer token.");
    const next = new McpClient(config.prefix, token.trim());
    await next.connect();
    if (tokenUsed.current !== token.trim()) {
      setEntry(undefined);
      setHistory([]);
      setSaved([]);
      setSavedDetails(undefined);
      setSavedId("");
    }
    client.current = next;
    tokenUsed.current = token.trim();
    setConnected(true);
    setConnectOpen(false);
    setNotice("Connected. Both analytical tools are available.");
  }
  function remember(answer: Answer, text: string, rerun = false) {
    const value = {
      id: ++id.current,
      question: text,
      answer,
      at: new Date().toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      saved: rerun,
    };
    setEntry(value);
    setHistory((h) => [value, ...h].slice(0, 20));
    setResultView("table");
    setView("workspace");
  }
  async function ask(text = question) {
    const api = activeClient();
    if (!text.trim()) throw Error("Enter a question first.");
    setEntry(undefined);
    setQuestion(text);
    const answer = await api.ask(text);
    remember(answer, text);
  }
  async function run(id: string, name?: string) {
    const api = activeClient();
    if (!id.trim()) throw Error("Enter a saved query ID.");
    setEntry(undefined);
    const answer = await api.run(id.trim());
    remember(answer, name || `Saved query ${id}`, true);
  }
  async function save() {
    const api = activeClient();
    if (!entry?.answer.resolution_id)
      throw Error("Ask a question before saving.");
    if (!saveName.trim()) throw Error("Enter a name.");
    const result = await api.save(entry.answer.resolution_id, saveName.trim());
    if (result.status !== "answered" || !result.saved_query_id)
      throw Error(result.message || "The query could not be saved.");
    setSaved((v) => [
      {
        id: result.saved_query_id!,
        name: saveName.trim(),
        question: entry.question,
      },
      ...v,
    ]);
    setSaveOpen(false);
    setNotice(
      `Saved “${saveName.trim()}”. Its definition is stored on the server.`,
    );
  }
  const answer = entry?.answer;
  const isAnswered = answer?.status === "answered";
  const examples =
    config?.questions
      .filter((q) => !q.startsWith("Ignore") && !q.startsWith("List"))
      .slice(0, 6) || [];
  return (
    <div className="app-shell">
      <a className="skip" href="#main">
        Skip to workspace
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("workspace");
          }}
        >
          <span className="brand-mark">
            <Icon name="spark" size={22} />
          </span>
          <span>
            CX<span className="brand-sub">SEMANTIC WORKSPACE</span>
          </span>
        </a>
        <div className="workspace-label">ANALYTICS</div>
        <nav aria-label="Main navigation">
          <button
            className={view === "workspace" ? "nav active" : "nav"}
            onClick={() => setView("workspace")}
          >
            <Icon name="grid" />
            Ask the data <span className="nav-dot" />
          </button>
          <button
            className={view === "saved" ? "nav active" : "nav"}
            onClick={() => setView("saved")}
          >
            <Icon name="save" />
            Saved queries <span className="count">{saved.length}</span>
          </button>
        </nav>
        <button
          className="new-question"
          disabled={!!busy}
          onClick={() => {
            setView("workspace");
            setEntry(undefined);
            setQuestion("");
            setNotice("");
            setError("");
          }}
        >
          <Icon name="plus" />
          New question
        </button>
        <div className="recent-heading">
          <span>THIS SESSION</span>
          <Icon name="clock" size={14} />
        </div>
        <div className="history">
          {history.length ? (
            history.map((h) => (
              <button
                disabled={!!busy}
                className={entry?.id === h.id ? "selected" : ""}
                key={h.id}
                onClick={() => {
                  setEntry(h);
                  setView("workspace");
                  setQuestion(h.question);
                }}
              >
                <span>{h.question}</span>
                <small>{h.at}</small>
              </button>
            ))
          ) : (
            <p>
              Your recent questions
              <br />
              will appear here.
            </p>
          )}
        </div>
        <div className="sidebar-bottom">
          <div className="source-symbol">
            <Icon name="database" />
          </div>
          <strong>{config?.model || "Semantic model"}</strong>
          <p>
            Governed definitions.
            <br />
            Traceable answers.
          </p>
          <div className="sidebar-foot">
            <span className="avatar">CX</span>
            <span>
              Analytics workspace
              <small>Session only · no browser storage</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span>{" "}
            <strong>
              {view === "workspace" ? "Ask the data" : "Saved queries"}
            </strong>
          </div>
          <button
            className={"connection-pill " + (connected ? "online" : "")}
            onClick={() => setConnectOpen(true)}
          >
            <span className="status-dot" />
            {connected ? "Service connected" : "Connect service"}
            <Icon name="settings" size={15} />
          </button>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="eyebrow">CUSTOMER EXPERIENCE INTELLIGENCE</div>
              <h1>
                {view === "workspace"
                  ? "A question. A trusted answer."
                  : "Your questions, ready to run."}
              </h1>
              <p>
                {view === "workspace"
                  ? "Explore your metrics in plain language. Every answer comes with its workings."
                  : "Keep the definition. Refresh the answer. No resolver LLM needed."}
              </p>
            </div>
            <div className="environment">
              <span className="status-dot" />
              {config?.execution_mode === "demo"
                ? "Sample data"
                : "Live warehouse"}
              <span className="environment-divider" />
              {config?.resolver_mode === "llm"
                ? "LLM resolver"
                : "Fixture resolver"}
            </div>
          </div>
          {config?.execution_mode === "demo" && (
            <div className="demo-banner">
              <Icon name="info" size={17} />
              <span>
                <strong>Demo workspace</strong> · Results use synthetic DuckDB
                data.
                {config.resolver_mode === "fixture"
                  ? " Choose an example question; free-form interpretation is not enabled."
                  : " Your question is interpreted by an LLM; results remain synthetic."}
              </span>
            </div>
          )}
          {(error || configError) && (
            <div className="alert error" role="alert">
              <Icon name="info" />
              <span>{error || configError}</span>
              <button
                aria-label="Dismiss error"
                onClick={() => {
                  setError("");
                  setConfigError("");
                }}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Icon name="check" />
              <span>{notice}</span>
              <button
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <Icon name="close" />
              </button>
            </div>
          )}
          {view === "workspace" ? (
            <>
              <section className="composer card" aria-label="Question composer">
                <div className="composer-label">
                  <Icon name="spark" />
                  <label htmlFor="question">
                    What would you like to understand?
                  </label>
                  <span>01 / ASK</span>
                </div>
                <textarea
                  id="question"
                  value={question}
                  disabled={!!busy}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="Ask about a metric, channel, or fiscal period…"
                  onKeyDown={(e) => {
                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                      e.preventDefault();
                      void perform("Asking your question", () => ask());
                    }
                  }}
                />
                <div className="composer-bottom">
                  <span>
                    <Icon name="shield" size={14} />
                    Grounded in your semantic model
                  </span>
                  <button
                    className="primary"
                    disabled={!!busy || !config || !question.trim()}
                    onClick={() =>
                      void perform("Resolving and executing", () => ask())
                    }
                  >
                    {busy ? (
                      <span className="spinner" />
                    ) : (
                      <Icon name="arrow" />
                    )}
                    {busy ? "Working…" : "Ask question"}
                  </button>
                </div>
              </section>
              <div className="examples">
                <span>TRY A QUESTION</span>
                {examples.map((q) => (
                  <button
                    disabled={!!busy}
                    key={q}
                    onClick={() => setQuestion(q)}
                  >
                    {q}
                    <Icon name="arrow" size={13} />
                  </button>
                ))}
              </div>
              {busy && (
                <div className="loading card" role="status" aria-live="polite">
                  <span className="spinner" />
                  <div>
                    <strong>{busy}…</strong>
                    <p>
                      Using governed definitions, filters, and aggregation
                      rules.
                    </p>
                  </div>
                </div>
              )}
              {answer && (
                <section className="answer-section" aria-label="Query answer">
                  <div className="answer-heading">
                    <div>
                      <span className={"answer-status " + answer.status}>
                        <Icon name={isAnswered ? "check" : "info"} size={15} />
                        {isAnswered
                          ? "ANSWERED"
                          : answer.status === "cannot_answer"
                            ? "MORE SPECIFICITY NEEDED"
                            : "REQUEST FAILED"}
                      </span>
                      <h2>{entry.question}</h2>
                    </div>
                    {isAnswered && (
                      <button
                        className="secondary"
                        disabled={!answer.resolution_id || !!busy}
                        onClick={() => {
                          setSaveName(entry.question.slice(0, 100));
                          setSaveOpen(true);
                        }}
                      >
                        <Icon name="save" />
                        Save query
                      </button>
                    )}
                  </div>
                  {isAnswered ? (
                    <div className="result-layout">
                      <div className="result-main">
                        <div className="interpretation">
                          <span className="eyebrow">OUR INTERPRETATION</span>
                          <p>{answer.interpretation}</p>
                        </div>
                        <div className="result-card card">
                          <div className="result-toolbar">
                            <div className="segmented">
                              <button
                                className={
                                  resultView === "table" ? "active" : ""
                                }
                                onClick={() => setResultView("table")}
                              >
                                <Icon name="table" size={16} />
                                Table
                              </button>
                              <button
                                className={
                                  resultView === "chart" ? "active" : ""
                                }
                                onClick={() => setResultView("chart")}
                              >
                                <Icon name="chart" size={16} />
                                Chart
                              </button>
                            </div>
                            <button
                              className="icon-button"
                              aria-label="Download results as CSV"
                              onClick={() => downloadCsv(answer)}
                            >
                              <Icon name="download" />
                            </button>
                          </div>
                          {answer.rows.length ? (
                            resultView === "table" ? (
                              <div className="table-wrap">
                                <table>
                                  <thead>
                                    <tr>
                                      {answer.columns.map((c) => (
                                        <th key={c.name}>
                                          {label(c.name)}
                                          <small>
                                            {c.role}
                                            {c.unit ? ` · ${c.unit}` : ""}
                                          </small>
                                        </th>
                                      ))}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {answer.rows.map((row, i) => (
                                      <tr key={i}>
                                        {row.map((value, j) => (
                                          <td
                                            key={j}
                                            className={
                                              answer.columns[j]?.role ===
                                              "metric"
                                                ? "numeric"
                                                : ""
                                            }
                                          >
                                            {displayValue(
                                              value,
                                              answer.columns[j],
                                            )}
                                          </td>
                                        ))}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <Chart key={entry.id} answer={answer} />
                            )
                          ) : (
                            <div className="empty-results">
                              No rows matched the governed query.
                            </div>
                          )}
                          <div className="result-footer">
                            <span>
                              {answer.rows.length} rows returned
                              {answer.truncated ? " · Results truncated" : ""}
                            </span>
                            <span>— = null / unavailable</span>
                          </div>
                        </div>
                        {answer.truncated && (
                          <div className="alert warning">
                            Results reached the row limit. Refine the question
                            before drawing conclusions.
                          </div>
                        )}
                        <details className="raw-response">
                          <summary>View complete response</summary>
                          <pre>{json(answer)}</pre>
                        </details>
                      </div>
                      <Provenance answer={answer} />
                    </div>
                  ) : (
                    <div className="card unanswerable">
                      <Icon name="info" size={28} />
                      <h3>
                        {answer.status === "cannot_answer"
                          ? "Let’s make the question more precise."
                          : "The request could not be completed."}
                      </h3>
                      <p>{answer.message}</p>
                      {answer.candidates?.length ? (
                        <>
                          <p className="muted">
                            Available definitions—choose one to start a new
                            question:
                          </p>
                          <div className="candidate-list">
                            {answer.candidates.map((c) => (
                              <button
                                key={c}
                                onClick={() => {
                                  setQuestion(`Show ${c}`);
                                }}
                              >
                                {label(c)}
                                <Icon name="arrow" size={14} />
                              </button>
                            ))}
                          </div>
                          <p className="muted">
                            In fixture mode, select the matching example
                            question above.
                          </p>
                        </>
                      ) : null}
                      <code>{answer.reason_code}</code>
                      <p className="request-id">
                        Request · {answer.request_id}
                      </p>
                      <details>
                        <summary>Complete response</summary>
                        <pre>{json(answer)}</pre>
                      </details>
                    </div>
                  )}
                </section>
              )}
              {!entry && !busy && (
                <section className="getting-started">
                  <div className="empty-illustration">
                    <span />
                    <Icon name="chart" size={40} />
                    <span />
                  </div>
                  <h2>Your next insight starts here.</h2>
                  <p>
                    Ask a question above. We’ll return the numbers,
                    <br />
                    the definition, and every choice along the way.
                  </p>
                  <div className="principles">
                    <span>
                      <Icon name="check" size={14} />
                      Governed metrics
                    </span>
                    <span>
                      <Icon name="check" size={14} />
                      Visible defaults
                    </span>
                    <span>
                      <Icon name="check" size={14} />
                      Full provenance
                    </span>
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="saved-area">
              {busy && (
                <div className="loading card" role="status">
                  <span className="spinner" />
                  <strong>{busy}…</strong>
                </div>
              )}
              <div className="card saved-lookup">
                <h3>Open a saved query</h3>
                <p>Use an ID from an earlier session or a dashboard.</p>
                <label htmlFor="saved-id">Saved query ID</label>
                <div className="input-row">
                  <input
                    id="saved-id"
                    placeholder="qry_…"
                    value={savedId}
                    onChange={(e) => setSavedId(e.target.value)}
                  />
                  <button
                    className="secondary"
                    disabled={!!busy}
                    onClick={() =>
                      void perform("Loading saved definition", async () => {
                        setSavedDetails(undefined);
                        setSavedDetails(
                          await activeClient().getSaved(savedId.trim()),
                        );
                      })
                    }
                  >
                    View definition
                  </button>
                  <button
                    className="primary"
                    disabled={!!busy || !savedId.trim()}
                    onClick={() =>
                      void perform("Running saved query", () => run(savedId))
                    }
                  >
                    Run query
                    <Icon name="arrow" />
                  </button>
                </div>
                {savedDetails && (
                  <details open>
                    <summary>Stored specification</summary>
                    <pre>{json(savedDetails)}</pre>
                  </details>
                )}
              </div>
              <div className="library-heading">
                <h2>
                  Saved in this session <span>{saved.length}</span>
                </h2>
                <p>
                  Definitions persist on the server. This list stays in page
                  memory only.
                </p>
              </div>
              {saved.length ? (
                saved.map((item) => (
                  <article className="card saved-item" key={item.id}>
                    <span className="icon-tile">
                      <Icon name="save" />
                    </span>
                    <div>
                      <h3>{item.name}</h3>
                      <p>{item.question}</p>
                      <code>{item.id}</code>
                    </div>
                    <button
                      className="secondary"
                      disabled={!!busy}
                      onClick={() =>
                        void perform("Running saved query", () =>
                          run(item.id, item.question),
                        )
                      }
                    >
                      Run again
                      <Icon name="arrow" size={16} />
                    </button>
                  </article>
                ))
              ) : (
                <div className="card library-empty">
                  <Icon name="save" size={30} />
                  <h3>Keep a question worth returning to.</h3>
                  <p>
                    Save an answered question from the workspace, or open an
                    existing ID above.
                  </p>
                </div>
              )}
            </section>
          )}
          <footer className="workspace-footer">
            <span>
              <Icon name="shield" size={13} />
              Powered by your semantic model
            </span>
            <span>
              MCP · MetricFlow ·{" "}
              {config?.execution_mode === "demo"
                ? "DuckDB"
                : label(config?.execution_mode || "Connecting")}
            </span>
          </footer>
        </main>
      </div>
      {connectOpen && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!busy) setConnectOpen(false);
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="connect-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close"
              aria-label="Close connection settings"
              disabled={!!busy}
              onClick={() => setConnectOpen(false)}
            >
              <Icon name="close" />
            </button>
            <span className="icon-tile">
              <Icon name="link" />
            </span>
            <h2 id="connect-title">Connect your workspace</h2>
            <p>Authenticate to discover and call the governed query tools.</p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform("Connecting to MCP", connect);
              }}
            >
              <label htmlFor="token">Bearer token</label>
              <input
                autoFocus
                id="token"
                type="password"
                autoComplete="off"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Enter your service token"
              />
              <p className="muted">
                Local fixture default: <code>local-demo-token</code>. Tokens are
                never stored in browser storage.
              </p>
              <div className="connection-detail">
                <span>Endpoint</span>
                <code>{config?.prefix || "/analytics"}/mcp</code>
              </div>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary full"
                disabled={!!busy || !token.trim()}
              >
                {busy ? "Connecting…" : "Connect and discover tools"}
                <Icon name="arrow" />
              </button>
            </form>
            {connected && (
              <button
                className="disconnect"
                disabled={!!busy}
                onClick={() => {
                  client.current = undefined;
                  tokenUsed.current = "";
                  setToken("");
                  setConnected(false);
                  setEntry(undefined);
                  setHistory([]);
                  setSaved([]);
                  setSavedDetails(undefined);
                  setSavedId("");
                  setConnectOpen(false);
                }}
              >
                Disconnect and clear session
              </button>
            )}
          </section>
        </div>
      )}
      {saveOpen && (
        <div className="modal-backdrop">
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="save-title"
          >
            <button
              className="modal-close"
              aria-label="Close save dialog"
              disabled={!!busy}
              onClick={() => setSaveOpen(false)}
            >
              <Icon name="close" />
            </button>
            <span className="icon-tile">
              <Icon name="save" />
            </span>
            <h2 id="save-title">Save this question</h2>
            <p>
              Store its governed definition. Future runs refresh the data and
              relative dates without a resolver call.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void perform("Saving query", save);
              }}
            >
              <label htmlFor="save-name">Query name</label>
              <input
                autoFocus
                id="save-name"
                maxLength={200}
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
              />
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button
                className="primary full"
                disabled={!!busy || !saveName.trim()}
              >
                Save query
                <Icon name="save" />
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
