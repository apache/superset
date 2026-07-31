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
import type { ChartData, ChartMeta, ColorScheme } from './types';

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
}

export interface BridgeInit {
  chartData: ChartData | null;
  meta: ChartMeta;
  context: HostContext;
  capabilities: HostCapabilities;
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

  private get isEmbedded(): boolean {
    return typeof window !== 'undefined' && window.parent && window.parent !== window;
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
          appCapabilities: { availableDisplayModes: ['inline', 'fullscreen'] },
        },
        timeoutMs,
      )) as HostInitResult;

      this.capabilities = deriveCapabilities(result);
      this.notify('ui/notifications/initialized', {});

      const { chartData, meta, error } = extractToolResult(result?.toolResult);
      return {
        chartData,
        meta,
        context: parseHostContext(result?.hostContext),
        capabilities: this.capabilities,
        connected: true,
        embedded: true,
        error,
      };
    } catch {
      // Host present but no timely/valid handshake. Do NOT fall back to sample
      // data — that would render fake numbers as if they were the user's chart.
      // Signal embedded+disconnected so the app shows a connection error.
      this.capabilities = emptyCapabilities();
      return {
        chartData: null,
        meta: {},
        context: { scheme: detectScheme() },
        capabilities: this.capabilities,
        connected: false,
        embedded: true,
      };
    }
  }

  private standaloneInit(): BridgeInit {
    this.capabilities = emptyCapabilities();
    return {
      chartData: null,
      meta: {},
      context: { scheme: detectScheme() },
      capabilities: this.capabilities,
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
  async callTool<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
    if (!this.isEmbedded || !this.capabilities.canCallTools) {
      throw new Error('tools/call unavailable outside a host');
    }
    const res = (await this.request('tools/call', { name, arguments: args })) as {
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
  async updateModelContext(text: string, structured?: Record<string, unknown>): Promise<void> {
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

  /** Request the host open an external link (deep link to Superset). */
  async openLink(url: string): Promise<boolean> {
    if (!this.isEmbedded) {
      try {
        window.open(url, '_blank', 'noopener');
        return true;
      } catch {
        return false;
      }
    }
    try {
      await this.request('ui/open-link', { url });
      return true;
    } catch {
      return false;
    }
  }

  /** Report intrinsic content size so the host can size the iframe. */
  reportSize(width: number, height: number): void {
    if (!this.isEmbedded) return;
    this.notify('ui/notifications/size-changed', { width, height });
  }

  /**
   * Ask the host to switch display mode. The handshake advertises `inline` and
   * `fullscreen` as supported; hosts that do not implement the request simply
   * never answer, so a rejection here is expected and callers fall back to
   * resizing the content in place.
   */
  async requestDisplayMode(mode: string): Promise<boolean> {
    if (!this.isEmbedded) return false;
    try {
      await this.request('ui/request-display-mode', { mode }, 1500);
      return true;
    } catch {
      return false;
    }
  }

  // ---- transport internals -------------------------------------------------

  private request(method: string, params: unknown, timeoutMs = 8000): Promise<unknown> {
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
    if (msg.id !== undefined && (('result' in msg) || 'error' in msg)) {
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
        const { chartData, meta, error } = extractToolResult(params);
        this.resultListeners.forEach((fn) => fn(chartData, meta, error));
        break;
      }
      case 'ui/notifications/host-context-changed': {
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

function deriveCapabilities(result: HostInitResult | undefined): HostCapabilities {
  const caps = (result?.hostCapabilities ?? {}) as Record<string, unknown>;
  const appTools = new Set<string>();
  // Hosts may advertise app-visible tools under a few shapes; be liberal.
  const toolList =
    (caps.appTools as unknown) ??
    (caps.tools as unknown) ??
    ((caps.experimental as Record<string, unknown> | undefined)?.appTools as unknown);
  if (Array.isArray(toolList)) {
    for (const t of toolList) {
      if (typeof t === 'string') appTools.add(t);
      else if (t && typeof t === 'object' && 'name' in t) appTools.add(String((t as { name: unknown }).name));
    }
  }
  const has = (k: string): boolean => k in caps && caps[k] !== false;
  // An unknown capability is treated as UNSUPPORTED (no optimistic `|| true`),
  // so host-dependent affordances (drill re-query, "ask about this") only light
  // up when the host actually advertises them.
  return {
    appTools,
    canCallTools: has('tools') || has('toolCalls') || appTools.size > 0,
    canUpdateModelContext: has('updateModelContext') || has('modelContext'),
    canSendMessage: has('message') || has('messages'),
  };
}

function emptyCapabilities(): HostCapabilities {
  return {
    appTools: new Set(),
    canUpdateModelContext: false,
    canSendMessage: false,
    canCallTools: false,
  };
}

function parseHostContext(ctx: Record<string, unknown> | undefined): HostContext {
  return {
    scheme: readScheme(ctx) ?? detectScheme(),
    displayMode: typeof ctx?.displayMode === 'string' ? (ctx.displayMode as string) : undefined,
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

function readScheme(ctx: Record<string, unknown> | undefined): ColorScheme | null {
  if (!ctx) return null;
  const raw =
    (ctx.theme as unknown) ??
    (ctx.colorScheme as unknown) ??
    ((ctx.styles as Record<string, unknown> | undefined)?.colorScheme as unknown);
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
export function extractToolResult(toolResult: unknown): {
  chartData: ChartData | null;
  meta: ChartMeta;
  error?: string;
} {
  if (!toolResult || typeof toolResult !== 'object') return { chartData: null, meta: {} };
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
    return { chartData: null, meta, error: block?.text || 'The chart tool returned an error.' };
  }
  // Superset ChartError payload: { error, error_type } with no columns/data.
  if (
    coerced &&
    typeof coerced === 'object' &&
    !isChartData(coerced) &&
    typeof (coerced as { error?: unknown }).error === 'string'
  ) {
    const e = coerced as { error: string; error_type?: string };
    return { chartData: null, meta, error: e.error_type ? `${e.error} (${e.error_type})` : e.error };
  }
  return { chartData: isChartData(coerced) ? (coerced as ChartData) : null, meta };
}

/** Prefer structuredContent; else parse the first JSON text content block. */
export function coerceToolResultData(res: {
  structuredContent?: unknown;
  content?: Array<{ type: string; text?: string }>;
}): unknown {
  if (res?.structuredContent && typeof res.structuredContent === 'object') {
    return res.structuredContent;
  }
  const block = res?.content?.find((c) => c.type === 'text' && c.text);
  if (block?.text) {
    try {
      return JSON.parse(block.text);
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
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}
