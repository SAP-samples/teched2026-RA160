import DOMPurify from 'dompurify';
import { marked } from 'marked';
import { useCallback, useEffect, useRef, useState } from 'react';
import { HighlightedCode } from './highlight.tsx';
import type { Message, ToolEntry, TurnGroup } from './types.ts';

marked.use({
  gfm: true,
  breaks: true,
  tokenizer: {
    del() {
      return undefined;
    },
  },
});

function parseMarkdown(md: string): DocumentFragment {
  const result = marked.parse(md);
  return DOMPurify.sanitize(typeof result === 'string' ? result : '', {
    RETURN_DOM_FRAGMENT: true,
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['del', 's', 'strike'],
  });
}

const DEMO_PROMPTS = [
  {
    label: '1. Actual spend — FY 2025',
    prompt:
      'Show me the monthly actual spend for cost center A1000 for fiscal year 2025.',
  },
  {
    label: '2. Forecast — FY 2026',
    prompt:
      'For cost center A1000, use planning ACTUAL entries from fiscal years 2022 through 2025 as context and forecast the monthly amount for fiscal year 2026. Summarize all 12 fiscal periods.',
  },
  {
    label: '3. Compare ground truth',
    prompt:
      'Compare the forecast with 2026 journal-entry ground truth for cost center A1000. Report the forecast, ground truth actuals, and period MAPE across all 12 periods.',
  },
];

// Human-readable labels for tool names
const TOOL_LABELS: Record<string, string> = {
  query_financial_planning: 'Querying financial planning data',
  query_journal_entry: 'Querying journal entries',
  query_local_db: 'Running SQL',
  run_sql: 'Running SQL',
  run_rpt_prediction_single: 'Running RPT prediction',
  js_eval: 'Analyzing JSON with JavaScript',
  run_rpt_prediction: 'Running RPT prediction',
  run_tabpfn_prediction: 'Running TabPFN prediction',
  get_ground_truth: 'Comparing against ground truth',
  drop_table: 'Cleaning up tables',
  create_view: 'Creating session view',
  read_file: 'Reading session file',
  write_file: 'Writing session file',
  list_files: 'Listing session files',
};

function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? name.replace(/_/g, ' ');
}

const RESULT_PREVIEW_CHARS = 2000;

function dedent(text: string): string {
  const lines = text.replace(/^\s*\n|\s+$/g, '').split('\n');
  const indent = Math.min(
    ...lines
      .filter((line) => line.trim())
      .map((line) => line.length - line.trimStart().length),
  );
  return lines.map((line) => line.slice(indent)).join('\n');
}

function previewValue(value: unknown): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return (text ?? '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

function formatResult(result: string): { text: string; isJson: boolean } {
  try {
    return { text: JSON.stringify(JSON.parse(result), null, 2), isJson: true };
  } catch {
    return { text: result, isJson: false };
  }
}

function truncate(text: string, maxChars: number): string {
  return text.length > maxChars ? `${text.slice(0, maxChars)}\n…` : text;
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) return `${Math.max(1, Math.round(durationMs))} ms`;
  return `${(durationMs / 1000).toFixed(durationMs < 10_000 ? 1 : 0)} s`;
}

function useElapsedDuration(
  startedAt: number,
  done: boolean,
  durationMs?: number,
): number {
  const [elapsedMs, setElapsedMs] = useState(() =>
    Math.max(0, Date.now() - startedAt),
  );

  useEffect(() => {
    if (done) return;

    const update = () => {
      setElapsedMs(Math.max(0, Date.now() - startedAt));
    };
    update();
    const intervalId = setInterval(update, 100);
    return () => clearInterval(intervalId);
  }, [done, startedAt]);

  return durationMs ?? elapsedMs;
}

const THINKING_PHRASES = [
  'Reticulating splines…',
  'Pondering deeply…',
  'Consulting the oracle…',
  'Crunching numbers…',
  'Doing math…',
  'Asking the database nicely…',
  'Staring at spreadsheets…',
  'Aligning fiscal years…',
  'Reversing the polarity…',
  'Checking the ledger…',
];

function useRotatingPhrase(active: boolean, intervalMs = 2200) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (!active) return;
    setIdx(Math.floor(Math.random() * THINKING_PHRASES.length));
    const id = setInterval(() => {
      setIdx((i) => (i + 1) % THINKING_PHRASES.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [active, intervalMs]);
  return THINKING_PHRASES[idx];
}

function ToolEntryCard({ t, isActive }: { t: ToolEntry; isActive: boolean }) {
  const [open, setOpen] = useState(false);
  const isDone = t.result !== undefined;
  const status = isDone ? 'done' : isActive ? 'pending' : 'queued';
  const durationMs = useElapsedDuration(t.startedAt, isDone, t.durationMs);
  const result = isDone ? formatResult(t.result ?? '') : null;
  const { sql, ...argsWithoutSql } = t.args;
  const sqlText = typeof sql === 'string' ? dedent(sql) : null;
  const otherArgs = sqlText === null ? t.args : argsWithoutSql;

  return (
    <div className={`tool-entry${isActive ? ' is-active' : ''}`}>
      <button
        type="button"
        className="tool-entry__row"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
      >
        <span
          className={`tool-entry__status ${status}`}
          role="status"
          aria-label={isDone ? 'complete' : isActive ? 'running' : 'waiting'}
        />
        <span className="tool-entry__name-text">{t.name}</span>
        <span
          className="tool-entry__duration"
          title={`Processing time: ${formatDuration(durationMs)}`}
        >
          {formatDuration(durationMs)}
        </span>
        <span className="tool-entry__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {!open && (
        <div className="tool-entry__preview">
          {Object.entries(t.args)
            .slice(0, 2)
            .map(([k, v]) => `${k}: ${previewValue(v)}`)
            .join(' · ')}
        </div>
      )}
      {open && (
        <div className="tool-entry__detail">
          {sqlText !== null && (
            <>
              <div className="tool-entry__detail-label">sql</div>
              <pre className="tool-entry__detail-pre tool-entry__detail-pre--code">
                <HighlightedCode code={sqlText} lang="sql" />
              </pre>
            </>
          )}
          {Object.keys(otherArgs).length > 0 && (
            <>
              <div className="tool-entry__detail-label">args</div>
              <pre className="tool-entry__detail-pre">
                <HighlightedCode
                  code={JSON.stringify(otherArgs, null, 2)}
                  lang="json"
                />
              </pre>
            </>
          )}
          {result && (
            <>
              <div className="tool-entry__detail-label">result</div>
              <pre className="tool-entry__detail-pre">
                {result.isJson ? (
                  <HighlightedCode
                    code={truncate(result.text, RESULT_PREVIEW_CHARS)}
                    lang="json"
                  />
                ) : (
                  truncate(result.text, RESULT_PREVIEW_CHARS)
                )}
              </pre>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ToolRail({
  turns,
  activeTurnId,
  activeToolIds,
  open,
  onClose,
}: {
  turns: TurnGroup[];
  activeTurnId: string | null;
  activeToolIds: ReadonlySet<string>;
  open: boolean;
  onClose: () => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const prevActiveTurnId = useRef<string | null>(null);

  // When a new turn becomes active, collapse the previous one
  useEffect(() => {
    if (
      activeTurnId &&
      prevActiveTurnId.current &&
      activeTurnId !== prevActiveTurnId.current
    ) {
      const previousTurnId = prevActiveTurnId.current;
      setCollapsed((prev) => new Set([...prev, previousTurnId]));
    }
    prevActiveTurnId.current = activeTurnId;
  }, [activeTurnId]);

  const toggle = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const reversed = [...turns].reverse();

  return (
    <>
      {open && (
        <div
          className="tool-rail-backdrop"
          onClick={onClose}
          aria-hidden="true"
        />
      )}
      <aside
        className={`tool-rail${open ? ' is-open' : ''}`}
        aria-label="Agent activity"
      >
        <div className="tool-rail__header">Activity</div>
        <div className="tool-rail__list" role="log" aria-live="polite">
          {turns.length === 0 && (
            <p className="tool-rail__empty">Tool calls appear here</p>
          )}
          {reversed.map((turn) => {
            const isOpen = !collapsed.has(turn.turnId);
            const pending = turn.tools.some((tool) =>
              activeToolIds.has(tool.id),
            );
            return (
              <div key={turn.turnId} className="turn-group">
                <button
                  type="button"
                  className={`turn-group__header${pending ? ' is-pending' : ''}`}
                  onClick={() => toggle(turn.turnId)}
                  aria-expanded={isOpen}
                >
                  <span
                    className={`tool-entry__status ${pending ? 'pending' : 'done'}`}
                    aria-hidden="true"
                  />
                  <span className="turn-group__label">{turn.label}</span>
                  <span className="turn-group__count">{turn.tools.length}</span>
                  <span className="turn-group__chevron">
                    {isOpen ? '▾' : '▸'}
                  </span>
                </button>
                {isOpen && (
                  <div className="turn-group__body">
                    {[...turn.tools].reverse().map((t) => (
                      <ToolEntryCard
                        key={t.id}
                        t={t}
                        isActive={activeToolIds.has(t.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}

function ActivityIndicator({ toolName }: { toolName: string | null }) {
  const phrase = useRotatingPhrase(!toolName);
  const label = toolName ? toolLabel(toolName) : phrase;
  return (
    <div className="msg-row msg-row--assistant">
      <div
        className="msg-bubble msg-bubble--thinking"
        role="status"
        aria-live="polite"
        aria-label="Agent working"
      >
        <span className="thinking-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>{label}</span>
      </div>
    </div>
  );
}

function SanitizedMarkdown({ content }: { content: string }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.replaceChildren(parseMarkdown(content));
  }, [content]);

  return <div ref={contentRef} className="msg-bubble msg-bubble--assistant" />;
}

function SanitizedThinking({ content }: { content: string }) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    contentRef.current?.replaceChildren(parseMarkdown(content));
  }, [content]);

  return <div ref={contentRef} className="thinking-markdown" />;
}

function ReasoningGroup({
  messages,
  isLive,
}: {
  messages: Message[];
  isLive: boolean;
}) {
  const [open, setOpen] = useState(isLive);

  useEffect(() => {
    setOpen(isLive);
  }, [isLive]);

  const updateLabel = `${messages.length} ${messages.length === 1 ? 'update' : 'updates'}`;

  return (
    <div className={`reasoning-group${isLive ? ' is-live' : ''}`}>
      <button
        type="button"
        className="reasoning-group__toggle"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
      >
        <span className="reasoning-group__marker" aria-hidden="true" />
        <span className="reasoning-group__label">
          {isLive ? 'Reasoning in progress' : 'Reasoning'}
        </span>
        <span className="reasoning-group__meta">{updateLabel}</span>
        <span className="reasoning-group__chevron" aria-hidden="true">
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div className="reasoning-group__body">
          {messages.map((message) => (
            <div key={message.id} className="reasoning-group__entry">
              <SanitizedThinking content={message.content} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ msg }: { msg: Message }) {
  if (msg.role === 'user') {
    return (
      <div className="msg-row msg-row--user">
        <div className="msg-bubble msg-bubble--user">{msg.content}</div>
      </div>
    );
  }

  if (msg.role === 'reasoning') return null;

  return (
    <div className="msg-row msg-row--assistant">
      <SanitizedMarkdown content={msg.content} />
    </div>
  );
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [turns, setTurns] = useState<TurnGroup[]>([]);
  const [activeTurnId, setActiveTurnId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [running, setRunning] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  // null = not running, '' = running but no tool yet, otherwise latest tool label
  const [activeToolName, setActiveToolName] = useState<string | null>(null);
  const [activeToolIds, setActiveToolIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement>(null);
  const idRef = useRef(0);
  const sessionRef = useRef<string | null>(null);
  const sessionPromiseRef = useRef<Promise<string> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const nextId = useCallback(() => String(++idRef.current), []);

  const ensureSession = useCallback(async (): Promise<string> => {
    if (sessionRef.current) return sessionRef.current;
    if (!sessionPromiseRef.current) {
      sessionPromiseRef.current = (async () => {
        const res = await fetch('/api/session', { method: 'POST' });
        if (!res.ok) {
          const body: unknown = await res.json().catch(() => null);
          const message =
            body !== null &&
            typeof body === 'object' &&
            'error' in body &&
            typeof body.error === 'string' &&
            body.error.trim()
              ? body.error
              : `Could not start a session (HTTP ${res.status}). Check the server terminal for details.`;
          throw new Error(message);
        }
        const { sessionId } = (await res.json()) as { sessionId: string };
        sessionRef.current = sessionId;
        return sessionId;
      })();
    }

    const pendingSession = sessionPromiseRef.current;
    try {
      return await pendingSession;
    } finally {
      if (sessionPromiseRef.current === pendingSession) {
        sessionPromiseRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    void ensureSession().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });
  }, [ensureSession]);

  const activeTurnHasResponse =
    activeTurnId !== null &&
    messages.some(
      (message) =>
        message.turnId === activeTurnId &&
        (message.role === 'reasoning' ||
          (message.role === 'assistant' && Boolean(message.content.trim()))),
    );
  const showActivity =
    running && (Boolean(activeToolName) || !activeTurnHasResponse);

  useEffect(() => {
    if (chatRef.current && (messages.length > 0 || showActivity)) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages.length, showActivity]);

  const runPrompt = useCallback(
    async (prompt: string) => {
      if (!prompt || running || resetting) return;

      setError(null);
      setRunning(true);
      setActiveToolName('');

      const turnId = nextId();
      setMessages((prev) => [
        ...prev,
        { id: nextId(), turnId, role: 'user', content: prompt },
      ]);
      setActiveTurnId(turnId);
      setTurns((prev) => [
        ...prev,
        {
          turnId,
          label: prompt.slice(0, 40) + (prompt.length > 40 ? '…' : ''),
          tools: [],
        },
      ]);

      let assistantId: string | null = null;

      try {
        let sessionId = await ensureSession();
        let res = await fetch('/api/agent/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt, sessionId }),
        });

        if (res.status === 401) {
          sessionRef.current = null;
          sessionId = await ensureSession();
          res = await fetch('/api/agent/run', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt, sessionId }),
          });
          setError(
            'Session expired — agent memory was reset. Continuing in a new session.',
          );
        }

        if (!res.ok || !res.body) throw new Error(`Server error ${res.status}`);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });

          const parts = buf.split('\n\n');
          buf = parts.pop() ?? '';

          for (const part of parts) {
            const eventLine = part.match(/^event:[ ]?(.+)/m)?.[1]?.trim();
            const dataLine = part.match(/^data:[ ]?(.+)/m)?.[1]?.trim();
            if (!eventLine || !dataLine) continue;

            const payload = JSON.parse(dataLine) as Record<string, unknown>;

            if (eventLine === 'thinking') {
              const text = payload.text as string;
              const tokens =
                typeof payload.tokens === 'number' ? payload.tokens : undefined;
              console.log(
                '%c[Agent Thinking]',
                'color: #0066cc; font-weight: bold; font-size: 11px;',
                text,
                tokens !== undefined ? `(${tokens} tokens)` : '',
              );
              setMessages((prev) => [
                ...prev,
                {
                  id: nextId(),
                  turnId,
                  role: 'reasoning',
                  content: text,
                },
              ]);
            } else if (eventLine === 'delta') {
              const text = payload.text as string;
              console.log(
                '%c[Agent Response]',
                'color: #1a7c4c; font-weight: bold; font-size: 11px;',
                text,
              );
              setActiveToolName(null);
              if (!assistantId) {
                const newAssistantId = nextId();
                assistantId = newAssistantId;
                setMessages((prev) => [
                  ...prev,
                  {
                    id: newAssistantId,
                    turnId,
                    role: 'assistant',
                    content: text,
                  },
                ]);
              } else {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantId
                      ? { ...m, content: m.content ? m.content + text : text }
                      : m,
                  ),
                );
              }
            } else if (eventLine === 'tool_call') {
              const entry: ToolEntry = {
                id: payload.id as string,
                name: payload.name as string,
                args: payload.args as Record<string, unknown>,
                startedAt: Date.now(),
              };
              console.log(
                '%c[Agent Tool Call]',
                'color: #b85c00; font-weight: bold; font-size: 11px;',
                entry.name,
                entry.args,
              );
              setTurns((prev) =>
                prev.map((t) =>
                  t.turnId === turnId
                    ? { ...t, tools: [...t.tools, entry] }
                    : t,
                ),
              );
              setActiveToolName(entry.name);
              setActiveToolIds((current) => {
                const next = new Set(current);
                next.add(entry.id);
                return next;
              });
            } else if (eventLine === 'tool_result') {
              const tid = payload.id as string;
              const raw = payload.result;
              const result =
                typeof raw === 'string' ? raw : JSON.stringify(raw);
              console.log(
                '%c[Agent Tool Result]',
                'color: #6e7a8a; font-size: 11px;',
                tid,
                result,
              );
              const completedAt = Date.now();
              setTurns((prev) =>
                prev.map((t) =>
                  t.turnId === turnId
                    ? {
                        ...t,
                        tools: t.tools.map((e) =>
                          e.id === tid
                            ? {
                                ...e,
                                result,
                                durationMs: Math.max(
                                  0,
                                  completedAt - e.startedAt,
                                ),
                              }
                            : e,
                        ),
                      }
                    : t,
                ),
              );
              setActiveToolIds((current) => {
                if (!current.has(tid)) return current;
                const next = new Set(current);
                next.delete(tid);
                return next;
              });
            } else if (eventLine === 'error') {
              setError(payload.message as string);
            }
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        const completedAt = Date.now();
        setTurns((prev) =>
          prev.map((turn) =>
            turn.turnId === turnId
              ? {
                  ...turn,
                  tools: turn.tools.map((entry) =>
                    entry.result === undefined
                      ? {
                          ...entry,
                          result: 'Tool execution completed.',
                          durationMs: Math.max(
                            0,
                            completedAt - entry.startedAt,
                          ),
                        }
                      : entry,
                  ),
                }
              : turn,
          ),
        );
        setRunning(false);
        setActiveToolName(null);
        setActiveToolIds(new Set());
        setActiveTurnId(null);
      }
    },
    [running, resetting, nextId, ensureSession],
  );

  const submit = useCallback(async () => {
    const prompt = input.trim();
    if (!prompt) return;
    setInput('');
    await runPrompt(prompt);
  }, [input, runPrompt]);

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void submit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  const pasteDemoPrompt = useCallback(
    (prompt: string) => {
      if (running) return;
      setInput(prompt);
      requestAnimationFrame(() => {
        const textarea = textareaRef.current;
        if (!textarea) return;
        textarea.focus();
        textarea.setSelectionRange(prompt.length, prompt.length);
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
      });
    },
    [running],
  );

  const resetDemo = useCallback(async () => {
    if (running || resetting) return;
    setResetting(true);
    setMessages([]);
    setTurns([]);
    setInput('');
    setError(null);
    setActiveTurnId(null);
    setActiveToolName(null);
    setActiveToolIds(new Set());
    idRef.current = 0;

    try {
      const sessionId = sessionRef.current ?? (await sessionPromiseRef.current);
      sessionRef.current = null;
      if (sessionId) {
        const res = await fetch(
          `/api/session/${encodeURIComponent(sessionId)}`,
          { method: 'DELETE' },
        );
        if (!res.ok) throw new Error(`Server error ${res.status}`);
      }
      await ensureSession();
    } catch (err) {
      setError(
        `Failed to reset session: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      setResetting(false);
    }
  }, [running, resetting, ensureSession]);

  const isEmpty = messages.length === 0;

  return (
    <>
      <header className="shell-bar">
        <span className="shell-bar__app">Financial Agent</span>
        <span className="shell-bar__sep" aria-hidden="true">
          /
        </span>
        <span className="shell-bar__sub">SAP Cloud SDK for AI</span>
        <button
          type="button"
          className="shell-bar__activity-toggle"
          onClick={() => setRailOpen((o) => !o)}
          aria-label={railOpen ? 'Hide activity' : 'Show activity'}
          aria-expanded={railOpen}
        >
          Activity
        </button>
        <button
          type="button"
          className="shell-bar__reset"
          onClick={() => void resetDemo()}
          disabled={running || resetting}
          aria-label="Reset demo and show prompt buttons"
        >
          {resetting ? 'Resetting…' : '↻ Reset demo'}
        </button>
      </header>

      {error && (
        <div className="error-strip" role="alert">
          {error}
        </div>
      )}

      <div className="layout">
        <ToolRail
          turns={turns}
          activeTurnId={activeTurnId}
          activeToolIds={activeToolIds}
          open={railOpen}
          onClose={() => setRailOpen(false)}
        />

        <div className="chat-pane">
          <div
            className="chat-area"
            ref={chatRef}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
          >
            {isEmpty && !running && (
              <div className="empty-state">
                <div className="empty-state__icon" aria-hidden="true">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M10 2C6.13 2 3 4.91 3 8.5c0 1.96.9 3.72 2.34 4.96L5 16l3.2-1.28A8 8 0 0010 15c3.87 0 7-2.91 7-6.5S13.87 2 10 2z"
                      fill="white"
                    />
                  </svg>
                </div>
                <p className="empty-state__title">Ask the financial agent</p>
                <p className="empty-state__sub">
                  Choose a demo prompt to paste into the composer
                </p>
                <fieldset className="suggestions">
                  <legend className="suggestions__legend">Demo prompts</legend>
                  {DEMO_PROMPTS.map(({ label, prompt }) => (
                    <button
                      type="button"
                      key={label}
                      className="suggestion-btn"
                      title={prompt}
                      onClick={() => pasteDemoPrompt(prompt)}
                      disabled={running || resetting}
                      aria-label={`Paste query: ${label}`}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
              </div>
            )}

            {messages.map((msg, index) => {
              if (msg.role === 'reasoning') {
                const previous = messages[index - 1];
                if (
                  previous?.role === 'reasoning' &&
                  previous.turnId === msg.turnId
                ) {
                  return null;
                }

                const end = messages.findIndex(
                  (candidate, candidateIndex) =>
                    candidateIndex > index &&
                    (candidate.role !== 'reasoning' ||
                      candidate.turnId !== msg.turnId),
                );
                const reasoningMessages = messages.slice(
                  index,
                  end === -1 ? undefined : end,
                );

                return (
                  <div className="msg-row msg-row--assistant" key={msg.id}>
                    <ReasoningGroup
                      messages={reasoningMessages}
                      isLive={running && msg.turnId === activeTurnId}
                    />
                  </div>
                );
              }

              return <MessageBubble key={msg.id} msg={msg} />;
            })}

            {showActivity && <ActivityIndicator toolName={activeToolName} />}
          </div>

          <div className="input-panel">
            <div className="input-panel__inner">
              <div className="composer">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInput}
                  onKeyDown={handleKey}
                  placeholder="Ask about budgets, costs, or forecasts…"
                  aria-label="Message input"
                  disabled={running || resetting}
                />
                <button
                  type="button"
                  className="btn-send"
                  onClick={() => void submit()}
                  disabled={running || resetting || !input.trim()}
                  aria-label="Send message"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 13 13"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M6.5 11V2M3 5.5l3.5-3.5 3.5 3.5"
                      stroke="white"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
              <p className="input-hint">Shift+Enter for new line</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
