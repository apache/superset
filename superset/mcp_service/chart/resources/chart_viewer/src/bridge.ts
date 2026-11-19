/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

/**
 * Thin, well-isolated bridge to the MCP Apps host. The rest of the widget
 * depends on this interface — never on the vendor package directly — so we can
 * swap the transport (direct postMessage vs. @modelcontextprotocol/ext-apps)
 * without touching the UI.
 *
 * It speaks the documented JSON-RPC-2.0-over-postMessage dialect from the
 * MCP Apps spec (2026-01-26): ui/initialize handshake, tool-result / host
 * context notifications, tools/call, ui/update-model-context, ui/open-link.
 * Outside a host (standalone dev), every call no-ops gracefully.
 */
import type {
  ChartData,
  ChartMeta,
  ColorScheme,
  DashboardRender,
} from './types';

/**
 * Display modes the widget can ask the host to switch between.
 *
 * `pip` is a floating overlay. The spec defines it as exactly that and says
 * nothing about whether it survives the next conversation turn, so the widget
 * offers it only where a host advertises it and makes no promise about how
 * long it stays.
 */
export type DisplayMode = 'inline' | 'fullscreen' | 'pip';

export interface HostContext {
  scheme: ColorScheme;
  displayMode?: string;
  container?: { width?: number; height?: number };
}

export interface HostCapabilities {
  /** Names of tools the host exposes to the app (visibility: ["app"]). */
  appTools: Set<string>;
  /** Whether the host accepts ui/update-model-context. */
  canUpdateModelContext: boolean;
  /** Whether the host accepts ui/message follow-ups. */
  canSendMessage: boolean;
  /** Whether tools/call is available at all. */
  canCallTools: boolean;
  /** Whether the host will open external URLs on our behalf (ui/open-link). */
  canOpenLinks: boolean;
  /** Whether the host will save files on our behalf (ui/download-file). */
  canDownloadFile: boolean;
}

/**
 * Everything the host told us at handshake, verbatim.
 *
 * `deriveCapabilities` guesses at several key spellings (`tools`, `toolCalls`,
 * `appTools`, `experimental.appTools`, ...) because the spec does not pin them.
 * A host that advertises under a name we do not read leaves every gated
 * affordance silently switched off, which is indistinguishable from a broken
 * feature. The raw maps are kept so that question can be answered by looking
 * rather than by guessing.
 */
export interface HostDiagnostics {
  protocolVersion?: string;
  /** Exactly what the host sent — no normalisation. */
  hostCapabilities: Record<string, unknown>;
  hostContext: Record<string, unknown>;
  /** 'null' in a sandboxed iframe without allow-same-origin. */
  origin: string;
  embedded: boolean;
  /** What we concluded from the above. */
  derived: HostCapabilities;
  /**
   * Top-level keys the host actually sent, verbatim.
   *
   * Surfaced in the collapsed summary because that one line has twice now been
   * the only diagnostic that made it out of a host — reading the expanded JSON
   * depends on a human transcribing it, which kept failing. The key names are
   * what identify a spelling mismatch, so they belong where they can be read
   * at a glance.
   */
  capabilityKeys: string[];
  /** Sandbox permissions the host granted (clipboard-write, etc.), if stated. */
  sandboxPermissions: string[];
  /**
   * The last few host-mediated exchanges, request and response together.
   *
   * Download and open-link have each cost several build/restart/test cycles
   * that ended in inferring backwards from a symptom, because the host's
   * answer is invisible from outside the iframe. Recording what we sent and
   * what came back turns "it does nothing" into a readable fact.
   */
  exchanges: HostExchange[];
  /**
   * Display modes the host offers (`inline` | `fullscreen` | `pip`).
   *
   * Surfaced because `pip` — a persistent side panel that survives while the
   * conversation continues — is a spec mode the widget does not yet request,
   * and whether it is worth building is decided entirely by whether hosts
   * advertise it here.
   */
  availableDisplayModes: string[];
}

/** One request/response pair with the host, for the diagnostics panel. */
export interface HostExchange {
  method: string;
  params: unknown;
  /** Verbatim result, or the failure if the request never resolved. */
  result?: unknown;
  failure?: string;
}

export interface BridgeInit {
  chartData: ChartData | null;
  /** Composite payload when the tool was render_dashboard. */
  dashboard?: DashboardRender | null;
  meta: ChartMeta;
  context: HostContext;
  capabilities: HostCapabilities;
  diagnostics: HostDiagnostics;
  /** True when a real MCP host answered the handshake. */
  connected: boolean;
  /**
   * True when running inside a host iframe. Distinguishes "embedded but the
   * handshake failed" (connected=false, embedded=true → show a connection
   * error, NEVER fake data) from "standalone dev" (embedded=false → sample
   * data is fine).
   */
  embedded: boolean;
  /** Error message when the initial tool result was a ChartError / isError. */
  error?: string;
}

/** App identity sent in the ui/initialize handshake (required by the spec). */
const APP_INFO = { name: 'superset-chart-viewer', version: '1.0.0' };

export type ContextListener = (ctx: Partial<HostContext>) => void;
export type ToolResultListener = (
  data: ChartData | null,
  meta: ChartMeta,
  error?: string,
  dashboard?: DashboardRender | null,
) => void;

interface PendingCall {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

const PROTOCOL_VERSION = '2026-01-26';

export class ChartBridge {
  private id = 0;
  private pending = new Map<number, PendingCall>();
  private contextListeners = new Set<ContextListener>();
  private resultListeners = new Set<ToolResultListener>();
  private capabilities: HostCapabilities = emptyCapabilities();
  /** Modes from HostContext.availableDisplayModes; null when unadvertised. */
  private hostDisplayModes: Set<string> | null = null;
  private hostMaxHeight: number | null = null;
  private diagnostics: HostDiagnostics = buildDiagnostics(
    undefined,
    emptyCapabilities(),
    false,
  );

  /**
   * Raw handshake data, for the in-widget diagnostics panel.
   *
   * Read directly by the panel rather than threaded through props: it must
   * stay available on every render path (loading, error, chart) without
   * depending on component state that a failed handshake never populates.
   */
  getDiagnostics(): HostDiagnostics {
    return this.diagnostics;
  }

  private get isEmbedded(): boolean {
    return (
      typeof window !== 'undefined' && window.parent && window.parent !== window
    );
  }

  /** Perform the ui/initialize handshake. Resolves with host-provided data. */
  async initialize(timeoutMs = 1500): Promise<BridgeInit> {
    if (!this.isEmbedded) {
      return this.standaloneInit();
    }
    window.addEventListener('message', this.onMessage);

    try {
      const result = (await this.request(
        'ui/initialize',
        {
          protocolVersion: PROTOCOL_VERSION,
          appInfo: APP_INFO,
          appCapabilities: {
            availableDisplayModes: ['inline', 'fullscreen', 'pip'],
          },
        },
        timeoutMs,
      )) as HostInitResult;

      this.capabilities = deriveCapabilities(result);
      this.hostDisplayModes = readDisplayModes(result?.hostContext);
      this.hostMaxHeight = readMaxHeight(result?.hostContext);
      this.diagnostics = buildDiagnostics(result, this.capabilities, true);
      this.notify('ui/notifications/initialized', {});

      const { chartData, dashboard, meta, error } = extractToolResult(
        result?.toolResult,
      );
      return {
        chartData,
        dashboard,
        meta,
        context: parseHostContext(result?.hostContext),
        capabilities: this.capabilities,
        diagnostics: this.diagnostics,
        connected: true,
        embedded: true,
        error,
      };
    } catch {
      // Host present but no timely/valid handshake. Do NOT fall back to sample
      // data — that would render fake numbers as if they were the user's chart.
      // Signal embedded+disconnected so the app shows a connection error.
      this.capabilities = emptyCapabilities();
      this.diagnostics = buildDiagnostics(undefined, this.capabilities, true);
      return {
        chartData: null,
        meta: {},
        context: { scheme: detectScheme() },
        capabilities: this.capabilities,
        diagnostics: this.diagnostics,
        connected: false,
        embedded: true,
      };
    }
  }

  private standaloneInit(): BridgeInit {
    this.capabilities = emptyCapabilities();
    this.diagnostics = buildDiagnostics(undefined, this.capabilities, false);
    return {
      chartData: null,
      meta: {},
      context: { scheme: detectScheme() },
      capabilities: this.capabilities,
      diagnostics: this.diagnostics,
      connected: false,
      embedded: false,
    };
  }

  getCapabilities(): HostCapabilities {
    return this.capabilities;
  }

  /** Subscribe to host context changes (theme / display mode / size). */
  onContextChange(fn: ContextListener): () => void {
    this.contextListeners.add(fn);
    return () => this.contextListeners.delete(fn);
  }

  /** Subscribe to late tool-result pushes (host may send data after init). */
  onToolResult(fn: ToolResultListener): () => void {
    this.resultListeners.add(fn);
    return () => this.resultListeners.delete(fn);
  }

  /** Call an app-visible server tool (e.g. render_chart_requery). */
  async callTool<T = unknown>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<T> {
    if (!this.isEmbedded || !this.capabilities.canCallTools) {
      throw new Error('tools/call unavailable outside a host');
    }
    const res = (await this.request('tools/call', {
      name,
      arguments: args,
    })) as {
      structuredContent?: unknown;
      content?: Array<{ type: string; text?: string }>;
    };
    return coerceToolResultData(res) as T;
  }

  /** True if the host exposes a given app-visible tool. */
  hasTool(name: string): boolean {
    // If the host enumerates app tools, require membership. Otherwise fall back
    // to whether tools/call is supported at all (an unknown capability is
    // treated as unsupported, so this stays false unless the host advertised
    // tool-calling). Drill affordances gate on this and disable cleanly.
    return this.capabilities.appTools.size
      ? this.capabilities.appTools.has(name)
      : this.capabilities.canCallTools;
  }

  /** Push a concise context string for the model's next turn ("Ask about this"). */
  async updateModelContext(
    text: string,
    structured?: Record<string, unknown>,
  ): Promise<void> {
    if (!this.isEmbedded || !this.capabilities.canUpdateModelContext) return;
    try {
      await this.request('ui/update-model-context', {
        content: [{ type: 'text', text }],
        ...(structured ? { structuredContent: structured } : {}),
      });
    } catch {
      /* best-effort */
    }
  }

  /** Send a follow-up user message to the host chat (feature-detected). */
  async sendMessage(text: string): Promise<void> {
    if (!this.isEmbedded || !this.capabilities.canSendMessage) return;
    try {
      await this.request('ui/message', {
        role: 'user',
        content: [{ type: 'text', text }],
      });
    } catch {
      /* best-effort */
    }
  }

  /**
   * Request the host open an external link (deep link to Superset).
   *
   * Hosts that do not implement ``ui/open-link`` typically leave the request
   * unanswered, so this uses a short timeout rather than the default: a click
   * must not sit for eight seconds doing nothing. On any failure it falls back
   * to opening directly, which works unless the iframe sandbox forbids popups.
   * Returns false when the link could not be opened by either route, so the
   * caller can offer the URL another way instead of failing silently.
   */
  async openLink(url: string, timeoutMs = 4000): Promise<boolean> {
    // Ask the host FIRST when it says it can do this. `openLinks` is a
    // spec-named capability backed by ui/open-link; going to window.open first
    // meant a sandboxed iframe (which blocks it) fell through to a host request
    // we then treated as a last resort. The host is the supported route.
    if (this.isEmbedded && this.capabilities.canOpenLinks) {
      if (await this.requestOk('ui/open-link', { url }, timeoutMs)) return true;
    }
    // Synchronously, inside the click's user gesture: awaiting anything first
    // spends transient activation and gets the popup blocked.
    try {
      if (typeof window !== 'undefined' && window.open(url, '_blank', 'noopener'))
        return true;
    } catch {
      /* sandboxed without allow-popups */
    }
    if (this.isEmbedded && !this.capabilities.canOpenLinks) {
      // Unadvertised, but the spec says hosts SHOULD implement it — worth one
      // attempt before giving up.
      if (await this.requestOk('ui/open-link', { url }, timeoutMs)) return true;
    }
    return false;
  }


  /**
   * Ask the host to save a file for the user.
   *
   * The spec exists for exactly our situation: "Since MCP Apps run in
   * sandboxed iframes where direct downloads are blocked, this provides a
   * host-mediated mechanism for file exports." The widget was instead building
   * a blob and clicking an anchor — a browser primitive the sandbox blocks
   * silently — while the host advertised `downloadFile` the whole time.
   *
   * Returns false when the host cannot do it or the user declined, so the
   * caller can fall back to showing the text instead of claiming a save.
   */
  async downloadViaHost(
    filename: string,
    mimeType: string,
    text: string,
    // Generous by default: the spec says the host SHOULD confirm with the user
    // first, so this waits on a human, not a machine.
    timeoutMs = 8000,
  ): Promise<boolean> {
    if (!this.isEmbedded || !this.capabilities.canDownloadFile) return false;
    return this.requestOk(
      'ui/download-file',
      {
        contents: [
          {
            type: 'resource',
            resource: { uri: `file:///${filename}`, mimeType, text },
          },
        ],
      },
      timeoutMs,
    );
  }


  /**
   * Send a request whose result carries `isError`, and record the exchange.
   *
   * The spec marks refusal with `isError` on the RESULT — the promise still
   * resolves. Treating a resolved promise as success is how "Open in Superset"
   * reported a link it had opened nothing for, and it is the same defect as
   * the display-mode control adopting a mode the host declined.
   */
  private async requestOk(
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Promise<boolean> {
    try {
      const result = (await this.request(method, params, timeoutMs)) as
        | { isError?: boolean }
        | undefined;
      const exchange: HostExchange = { method, params, result };
      this.record(exchange);
      if (result?.isError === true) {
        this.reportFailure(exchange);
        return false;
      }
      return true;
    } catch (err) {
      const exchange: HostExchange = { method, params, failure: String(err) };
      this.record(exchange);
      this.reportFailure(exchange);
      return false;
    }
  }

  private record(exchange: HostExchange): void {
    const kept = [...this.diagnostics.exchanges, exchange].slice(-6);
    this.diagnostics = { ...this.diagnostics, exchanges: kept };
  }

  /** Operations already reported, so a repeated failure cannot spam context. */
  private reportedFailures = new Set<string>();

  /**
   * Push a failed host operation into the model's context.
   *
   * Every capability question on this branch — serverTools, the display modes,
   * the download and open-link routes — took several round trips for one
   * reason: the host's answer is visible only inside the iframe, so diagnosing
   * it needed a person to read JSON off a screen and retype it. The host
   * advertises `updateModelContext`, so the widget can hand the detail to the
   * assistant directly instead.
   *
   * Failures only, once per operation, and never for the reporting call itself
   * — a report that could fail and then report its own failure would loop.
   */
  private reportFailure(exchange: HostExchange): void {
    // Defensive, not load-bearing: updateModelContext sends via `request`
    // rather than `requestOk`, so it cannot reach here today. Kept so that
    // routing it through the shared helper later cannot create a report that
    // reports its own failure.
    if (exchange.method === 'ui/update-model-context') return;
    if (!this.capabilities.canUpdateModelContext) return;
    if (this.reportedFailures.has(exchange.method)) return;
    this.reportedFailures.add(exchange.method);
    const detail = exchange.failure
      ? `no reply (${exchange.failure})`
      : `replied ${safeJson(exchange.result)}`;
    void this.updateModelContext(
      `Superset chart widget diagnostic: the host declined ${exchange.method}. ` +
        `It ${detail}. Sent: ${safeJson(exchange.params)}. ` +
        `Developer detail, not something the user asked about.`,
    );
  }

  /** Report intrinsic content size so the host can size the iframe. */
  reportSize(width: number, height: number): void {
    if (!this.isEmbedded) return;
    this.notify('ui/notifications/size-changed', { width, height });
  }

  /**
   * The tallest frame the host says it will give us, if it says.
   *
   * Desktop reports maxHeight 5000 while the widget capped itself at 1200 —
   * and since that host offers no fullscreen mode, growing the frame IS the
   * maximize feature, so the guess was the ceiling on the control people use
   * most.
   */
  getHostMaxHeight(): number | null {
    return this.hostMaxHeight;
  }

  /** Display modes the host advertised, or null if it advertised none. */
  getHostDisplayModes(): Set<string> | null {
    return this.hostDisplayModes;
  }

  /**
   * Whether the host offers a mode, for gating the control that requests it.
   *
   * A host that advertises nothing is treated as "might support it" — we
   * cannot tell, and requesting is harmless. A host that advertises a list
   * without this mode is treated as a definite no, so the widget never shows
   * a button it knows will do nothing.
   */
  supportsDisplayMode(mode: DisplayMode): boolean {
    return this.hostDisplayModes ? this.hostDisplayModes.has(mode) : true;
  }

  /**
   * Ask the host to switch display mode, resolving with the mode the host
   * actually applied.
   *
   * Deliberately NOT a boolean. The spec requires the host to return the
   * resulting mode "whether updated or not", and a host that declines a switch
   * answers with the mode it is staying in — so `null` (no usable answer) and
   * "declined, still fullscreen" are different situations that need different
   * handling. Collapsing both to `false` made the widget treat a refusal as
   * "host has no display-mode support" and set its own state to the mode it
   * had merely *asked* for, which is how the collapse control came to report
   * success while the host stayed expanded.
   *
   * Returns null when the host cannot service the request at all: not embedded,
   * the mode is absent from the host's advertised `availableDisplayModes`, or
   * the request went unanswered.
   */
  async requestDisplayMode(
    mode: DisplayMode,
    timeoutMs = 1200,
  ): Promise<DisplayMode | null> {
    if (!this.isEmbedded) return null;
    // The spec makes checking this the View's obligation, and it also spares
    // the user a timeout's worth of dead button on hosts without mode support.
    if (this.hostDisplayModes && !this.hostDisplayModes.has(mode)) return null;
    try {
      const result = (await this.request(
        'ui/request-display-mode',
        { mode },
        timeoutMs,
      )) as { mode?: unknown };
      return asDisplayMode(result?.mode);
    } catch {
      return null;
    }
  }

  // ---- transport internals -------------------------------------------------

  private request(
    method: string,
    params: unknown,
    timeoutMs = 8000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      this.post({ jsonrpc: '2.0', id, method, params });
      if (timeoutMs > 0) {
        setTimeout(() => {
          if (this.pending.has(id)) {
            this.pending.delete(id);
            reject(new Error(`Timed out waiting for ${method}`));
          }
        }, timeoutMs);
      }
    });
  }

  private notify(method: string, params: unknown): void {
    this.post({ jsonrpc: '2.0', method, params });
  }

  private post(msg: unknown): void {
    try {
      window.parent.postMessage(msg, '*');
    } catch {
      /* no-op */
    }
  }

  private onMessage = (event: MessageEvent): void => {
    const msg = event.data as JsonRpcMessage | undefined;
    if (!msg || msg.jsonrpc !== '2.0') return;

    // Response to one of our requests.
    if (msg.id !== undefined && ('result' in msg || 'error' in msg)) {
      const pending = this.pending.get(msg.id as number);
      if (!pending) return;
      this.pending.delete(msg.id as number);
      if ('error' in msg && msg.error) pending.reject(msg.error);
      else pending.resolve((msg as { result?: unknown }).result);
      return;
    }

    // Host-initiated notifications.
    if (typeof msg.method === 'string') {
      this.handleNotification(msg.method, msg.params);
    }
  };

  private handleNotification(method: string, params: unknown): void {
    switch (method) {
      case 'ui/notifications/tool-result': {
        const { chartData, dashboard, meta, error } = extractToolResult(params);
        this.resultListeners.forEach((fn) =>
          fn(chartData, meta, error, dashboard),
        );
        break;
      }
      case 'ui/notifications/host-context-changed': {
        // The spec types this notification's params as a full HostContext, so
        // a host may announce its display modes here rather than (or later
        // than) at initialize. Capturing them only at handshake left us
        // permanently blind to a host that advertises pip after startup —
        // indistinguishable from a host that does not support it, which is
        // exactly how `serverTools` read as "unsupported" for days.
        const modes = readDisplayModes(
          params as Record<string, unknown> | undefined,
        );
        if (modes) {
          this.hostDisplayModes = modes;
          this.diagnostics = {
            ...this.diagnostics,
            availableDisplayModes: Array.from(modes),
          };
        }
        const ctx = parsePartialHostContext(params);
        if (ctx) this.contextListeners.forEach((fn) => fn(ctx));
        break;
      }
      default:
        break;
    }
  }
}

interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
}

interface HostInitResult {
  protocolVersion?: string;
  hostCapabilities?: Record<string, unknown>;
  hostContext?: Record<string, unknown>;
  toolResult?: unknown;
}

function buildDiagnostics(
  result: HostInitResult | undefined,
  derived: HostCapabilities,
  embedded: boolean,
): HostDiagnostics {
  let origin = 'unknown';
  try {
    origin = window.origin || 'null';
  } catch {
    origin = 'null';
  }
  const caps = (result?.hostCapabilities ?? {}) as Record<string, unknown>;
  const sandbox = caps.sandbox as { permissions?: object } | undefined;
  return {
    protocolVersion: result?.protocolVersion,
    hostCapabilities: caps,
    hostContext: (result?.hostContext ?? {}) as Record<string, unknown>,
    origin,
    embedded,
    derived,
    exchanges: [],
    capabilityKeys: Object.keys(caps),
    sandboxPermissions: Object.keys(sandbox?.permissions ?? {}),
    availableDisplayModes: Array.from(
      readDisplayModes(result?.hostContext) ?? [],
    ),
  };
}

function deriveCapabilities(
  result: HostInitResult | undefined,
): HostCapabilities {
  const caps = (result?.hostCapabilities ?? {}) as Record<string, unknown>;
  const appTools = new Set<string>();
  // Hosts may advertise app-visible tools under a few shapes; be liberal.
  const toolList =
    (caps.appTools as unknown) ??
    (caps.tools as unknown) ??
    ((caps.experimental as Record<string, unknown> | undefined)
      ?.appTools as unknown);
  if (Array.isArray(toolList)) {
    for (const t of toolList) {
      if (typeof t === 'string') appTools.add(t);
      else if (t && typeof t === 'object' && 'name' in t)
        appTools.add(String((t as { name: unknown }).name));
    }
  }
  const has = (k: string): boolean => k in caps && caps[k] !== false;
  // An unknown capability is treated as UNSUPPORTED (no optimistic `|| true`),
  // so host-dependent affordances (drill re-query, "ask about this") only light
  // up when the host actually advertises them.
  //
  // `serverTools` is the SPEC name for "host can proxy tool calls to the MCP
  // server" (HostCapabilities, 2026-01-26). Reading only the pre-spec guesses
  // below made every conformant host look like it forbade tool calls, which
  // silently disabled click-to-drill everywhere — the host was offering the
  // capability under the name the spec defines and we were not looking at it.
  return {
    appTools,
    canCallTools:
      has('serverTools') ||
      has('tools') ||
      has('toolCalls') ||
      appTools.size > 0,
    canUpdateModelContext: has('updateModelContext') || has('modelContext'),
    canSendMessage: has('message') || has('messages'),
    // Both are spec-named HostCapabilities backed by dedicated requests. The
    // widget used browser primitives for these instead — window.open and an
    // <a download> click — which a sandboxed iframe blocks. The spec says so
    // explicitly: ui/download-file exists "since MCP Apps run in sandboxed
    // iframes where direct downloads are blocked".
    canOpenLinks: has('openLinks'),
    canDownloadFile: has('downloadFile'),
  };
}

function emptyCapabilities(): HostCapabilities {
  return {
    appTools: new Set(),
    canUpdateModelContext: false,
    canSendMessage: false,
    canCallTools: false,
    canOpenLinks: false,
    canDownloadFile: false,
  };
}

/** JSON that cannot itself throw, for diagnostic strings. */
function safeJson(value: unknown, max = 400): string {
  try {
    const out = JSON.stringify(value);
    return out.length > max ? `${out.slice(0, max)}\u2026` : out;
  } catch {
    return String(value);
  }
}

/** Narrow a host-reported mode to one this widget knows how to render. */
function asDisplayMode(value: unknown): DisplayMode | null {
  return value === 'inline' || value === 'fullscreen' || value === 'pip'
    ? value
    : null;
}

/**
 * Host's advertised display modes. Null (rather than an empty set) when the
 * host says nothing, so "advertised none" and "did not advertise" stay
 * distinguishable — only the former justifies skipping the request.
 */
function readDisplayModes(
  ctx: Record<string, unknown> | undefined,
): Set<string> | null {
  const raw = ctx?.availableDisplayModes;
  if (!Array.isArray(raw)) return null;
  return new Set(raw.filter((m): m is string => typeof m === 'string'));
}

function parseHostContext(
  ctx: Record<string, unknown> | undefined,
): HostContext {
  return {
    scheme: readScheme(ctx) ?? detectScheme(),
    displayMode:
      typeof ctx?.displayMode === 'string'
        ? (ctx.displayMode as string)
        : undefined,
    container: readContainer(ctx),
  };
}

function parsePartialHostContext(params: unknown): Partial<HostContext> | null {
  if (!params || typeof params !== 'object') return null;
  const ctx = params as Record<string, unknown>;
  const out: Partial<HostContext> = {};
  const scheme = readScheme(ctx);
  if (scheme) out.scheme = scheme;
  if (typeof ctx.displayMode === 'string') out.displayMode = ctx.displayMode;
  const container = readContainer(ctx);
  if (container) out.container = container;
  return Object.keys(out).length ? out : null;
}

function readScheme(
  ctx: Record<string, unknown> | undefined,
): ColorScheme | null {
  if (!ctx) return null;
  const raw =
    (ctx.theme as unknown) ??
    (ctx.colorScheme as unknown) ??
    ((ctx.styles as Record<string, unknown> | undefined)
      ?.colorScheme as unknown);
  if (typeof raw === 'string') {
    const v = raw.toLowerCase();
    if (v.includes('dark')) return 'dark';
    if (v.includes('light')) return 'light';
  }
  if (raw && typeof raw === 'object' && 'mode' in raw) {
    const v = String((raw as { mode: unknown }).mode).toLowerCase();
    if (v.includes('dark')) return 'dark';
    if (v.includes('light')) return 'light';
  }
  return null;
}

/** Host-stated ceiling for our frame, when it gives one. */
export function readMaxHeight(ctx: Record<string, unknown> | undefined): number | null {
  const dims = ctx?.containerDimensions as
    | { height?: unknown; maxHeight?: unknown }
    | undefined;
  const v = typeof dims?.height === 'number' ? dims.height : dims?.maxHeight;
  return typeof v === 'number' && v > 0 ? v : null;
}

function readContainer(
  ctx: Record<string, unknown> | undefined,
): { width?: number; height?: number } | undefined {
  const c = ctx?.container as Record<string, unknown> | undefined;
  if (!c) return undefined;
  const width = typeof c.width === 'number' ? c.width : undefined;
  const height = typeof c.height === 'number' ? c.height : undefined;
  return width || height ? { width, height } : undefined;
}

/** Pull ChartData + _meta (and any error) out of a CallToolResult-shaped object. */
/** A render_dashboard payload: a layout with cells, not columns and rows. */
export function isDashboardRender(v: unknown): v is DashboardRender {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as { cells?: unknown }).cells)
  );
}

export function extractToolResult(toolResult: unknown): {
  chartData: ChartData | null;
  dashboard: DashboardRender | null;
  meta: ChartMeta;
  error?: string;
} {
  if (!toolResult || typeof toolResult !== 'object')
    return { chartData: null, dashboard: null, meta: {} };
  const tr = toolResult as {
    structuredContent?: unknown;
    content?: Array<{ type: string; text?: string }>;
    _meta?: Record<string, unknown>;
    isError?: boolean;
  };
  const meta = (tr._meta ?? {}) as ChartMeta;
  const coerced = coerceToolResultData(tr);

  // MCP tool-level error: surface the text content as the message.
  if (tr.isError) {
    const block = tr.content?.find((c) => c.type === 'text' && c.text);
    return {
      chartData: null,
      dashboard: null,
      meta,
      error: block?.text || 'The chart tool returned an error.',
    };
  }
  // Superset ChartError payload: { error, error_type } with no columns/data.
  if (
    coerced &&
    typeof coerced === 'object' &&
    !isChartData(coerced) &&
    typeof (coerced as { error?: unknown }).error === 'string'
  ) {
    const e = coerced as { error: string; error_type?: string };
    return {
      chartData: null,
      dashboard: null,
      meta,
      error: e.error_type ? `${e.error} (${e.error_type})` : e.error,
    };
  }
  return {
    chartData: isChartData(coerced) ? (coerced as ChartData) : null,
    dashboard: isDashboardRender(coerced) ? coerced : null,
    meta,
  };
}

/**
 * FastMCP wraps non-plain-object return types in a synthetic `result` envelope
 * (such tool schemas are marked `x-fastmcp-wrap-result`). Our tools are typed
 * `-> ChartData | ChartError`, so the payload on the wire is
 * `{"result": {...}}` rather than the bare object.
 *
 * Unwrap only when `result` is the SOLE key, so a future unwrapped payload —
 * or one that legitimately carries other fields — still passes through intact.
 */
function unwrapResultEnvelope(value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const keys = Object.keys(value as Record<string, unknown>);
  if (keys.length === 1 && keys[0] === 'result') {
    const inner = (value as { result: unknown }).result;
    if (inner && typeof inner === 'object') return inner;
  }
  return value;
}

/** Prefer structuredContent; else parse the first JSON text content block. */
export function coerceToolResultData(res: {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
}): unknown {
  if (res?.structuredContent && typeof res.structuredContent === 'object') {
    return unwrapResultEnvelope(res.structuredContent);
  }
  const block = res?.content?.find((c) => c.type === 'text' && c.text);
  if (block?.text) {
    try {
      return unwrapResultEnvelope(JSON.parse(block.text));
    } catch {
      return null;
    }
  }
  return null;
}

function isChartData(v: unknown): v is ChartData {
  return (
    !!v &&
    typeof v === 'object' &&
    Array.isArray((v as ChartData).columns) &&
    Array.isArray((v as ChartData).data)
  );
}

function detectScheme(): ColorScheme {
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }
  return 'light';
}
