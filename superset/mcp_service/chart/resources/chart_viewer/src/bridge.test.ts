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

import { describe, expect, it } from 'vitest';
import { extractToolResult } from './bridge';

// The bridge's wire contract with an MCP Apps host. These are the behaviors a
// non-conformant host would break, and the safety rule that fake data must
// never masquerade as a real chart.

describe('extractToolResult', () => {
  // The server's tools are typed `-> ChartData | ChartError`, and FastMCP wraps
  // union returns in a synthetic `result` envelope (schemas carry
  // `x-fastmcp-wrap-result`). THIS is the real wire shape — verified against a
  // live MCP server. An earlier version of this test asserted the unwrapped
  // shape, which the server never sends, so it passed while the widget was
  // unable to read its own data.
  it('returns ChartData from the FastMCP-wrapped structuredContent', () => {
    const { chartData, error } = extractToolResult({
      structuredContent: { result: { columns: [], data: [], chart_id: 1 } },
    });
    expect(error).toBeUndefined();
    expect(chartData).not.toBeNull();
    expect(chartData?.chart_id).toBe(1);
  });

  it('still accepts an unwrapped structuredContent payload', () => {
    const { chartData } = extractToolResult({
      structuredContent: { columns: [], data: [], chart_id: 2 },
    });
    expect(chartData?.chart_id).toBe(2);
  });

  it('does not unwrap when `result` is not the sole key', () => {
    // A legitimate payload that happens to carry a `result` field alongside
    // real ChartData fields must pass through untouched.
    const { chartData } = extractToolResult({
      structuredContent: { result: 'ok', columns: [], data: [], chart_id: 3 },
    });
    expect(chartData?.chart_id).toBe(3);
  });

  it('surfaces a wrapped Superset ChartError payload as an error', () => {
    const { chartData, error } = extractToolResult({
      structuredContent: {
        result: { error: 'Chart not found', error_type: 'NotFound' },
      },
    });
    expect(chartData).toBeNull();
    expect(error).toBe('Chart not found (NotFound)');
  });

  it('surfaces an MCP isError result as an error', () => {
    const { chartData, error } = extractToolResult({
      isError: true,
      content: [{ type: 'text', text: 'permission denied' }],
    });
    expect(chartData).toBeNull();
    expect(error).toBe('permission denied');
  });

  it('parses ChartData from a JSON text content block when no structuredContent', () => {
    const { chartData } = extractToolResult({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ columns: [], data: [], chart_id: 9 }),
        },
      ],
    });
    expect(chartData?.chart_id).toBe(9);
  });

  it('returns null chart data for an unrecognized payload', () => {
    const { chartData, error } = extractToolResult({ content: [] });
    expect(chartData).toBeNull();
    expect(error).toBeUndefined();
  });
});

// deriveCapabilities is not exported; assert the observable contract via a
// simulated handshake instead. We drive ChartBridge against a fake host that
// records the outgoing ui/initialize params and replies with a known result.
import { ChartBridge } from './bridge';

interface Captured {
  method: string;
  params: Record<string, unknown>;
  id?: number;
}

function withFakeHost(
  hostReply: (msg: Captured) => Record<string, unknown> | undefined,
): { restore: () => void; sent: Captured[] } {
  const sent: Captured[] = [];
  const realParent = window.parent;
  // Force embedded mode: window.parent !== window.
  const fakeParent = {
    postMessage: (msg: Captured) => {
      sent.push(msg);
      const reply = hostReply(msg);
      if (reply && msg.id !== undefined) {
        window.dispatchEvent(
          new MessageEvent('message', {
            data: { jsonrpc: '2.0', id: msg.id, result: reply },
          }),
        );
      }
    },
  };
  Object.defineProperty(window, 'parent', {
    value: fakeParent,
    configurable: true,
  });
  return {
    sent,
    restore: () =>
      Object.defineProperty(window, 'parent', {
        value: realParent,
        configurable: true,
      }),
  };
}

describe('ChartBridge handshake contract', () => {
  it('sends appInfo in ui/initialize and treats unknown capabilities as unsupported', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        // Host advertises NO capabilities.
        return {
          protocolVersion: '2026-01-26',
          hostCapabilities: {},
          hostContext: {},
        };
      }
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      const init = await bridge.initialize(500);
      const initMsg = host.sent.find((m) => m.method === 'ui/initialize');
      // Required by the spec — a strict host rejects initialize without it.
      expect(initMsg?.params.appInfo).toEqual({
        name: 'superset-chart-viewer',
        version: '1.0.0',
      });
      // Unknown capabilities must be OFF (no optimistic `|| true`).
      expect(init.capabilities.canCallTools).toBe(false);
      expect(init.capabilities.canUpdateModelContext).toBe(false);
      expect(init.capabilities.canSendMessage).toBe(false);
      expect(init.connected).toBe(true);
      expect(init.embedded).toBe(true);
    } finally {
      host.restore();
    }
  });

  it('reports embedded+disconnected (never sample data) when the handshake times out', async () => {
    const host = withFakeHost(() => undefined); // host never replies
    try {
      const bridge = new ChartBridge();
      const init = await bridge.initialize(50);
      expect(init.connected).toBe(false);
      expect(init.embedded).toBe(true);
      expect(init.chartData).toBeNull();
    } finally {
      host.restore();
    }
  });

  it('sends ui/message content as an array', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        return { hostCapabilities: { message: true }, hostContext: {} };
      }
      if (msg.method === 'ui/message') return {};
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await bridge.sendMessage('hello');
      const msg = host.sent.find((m) => m.method === 'ui/message');
      expect(Array.isArray(msg?.params.content)).toBe(true);
    } finally {
      host.restore();
    }
  });

  it('requests fullscreen mode with the spec-defined params', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        return { hostCapabilities: {}, hostContext: {} };
      }
      if (msg.method === 'ui/request-display-mode') {
        return { mode: 'fullscreen' };
      }
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.requestDisplayMode('fullscreen', 500)).resolves.toBe(
        'fullscreen',
      );
      const msg = host.sent.find((m) => m.method === 'ui/request-display-mode');
      expect(msg?.params).toEqual({ mode: 'fullscreen' });
    } finally {
      host.restore();
    }
  });

  // The spec requires the host to answer with "the resulting mode (whether
  // updated or not)", so a decline is a *different mode*, not a failure. This
  // must stay distinguishable from an unanswered request: the widget treats
  // the former as "the host is authoritative and still expanded" and the
  // latter as "the host has no display-mode support, size myself".
  it('reports the mode the host actually applied when it declines', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        return { hostCapabilities: {}, hostContext: {} };
      }
      if (msg.method === 'ui/request-display-mode') {
        return { mode: 'fullscreen' };
      }
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.requestDisplayMode('inline', 500)).resolves.toBe(
        'fullscreen',
      );
    } finally {
      host.restore();
    }
  });

  it('reports null when the host leaves the request unanswered', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities: {}, hostContext: {} }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(
        bridge.requestDisplayMode('fullscreen', 100),
      ).resolves.toBeNull();
    } finally {
      host.restore();
    }
  });

  // Spec: "View MUST check if the requested mode is in availableDisplayModes
  // from host context before requesting a mode change." Skipping the round
  // trip also spares the user a timeout's worth of unresponsive button.
  it('does not ask for a mode the host did not advertise', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        return {
          hostCapabilities: {},
          hostContext: { availableDisplayModes: ['inline'] },
        };
      }
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(
        bridge.requestDisplayMode('fullscreen', 5000),
      ).resolves.toBeNull();
      expect(
        host.sent.some((m) => m.method === 'ui/request-display-mode'),
      ).toBe(false);
    } finally {
      host.restore();
    }
  });

  // "Open in Superset" did nothing in a real host: ui/open-link went
  // unanswered, the widget waited out the full default timeout, and the
  // rejection was swallowed with no fallback and nothing shown to the user.
  //
  // Ordering matters and is the point of these three. window.open must be
  // attempted synchronously inside the click's user gesture; awaiting the host
  // first spends transient activation and gets the popup blocked.
  const LINK = 'https://superset.example/explore/?slice_id=1';

  it('opens directly without asking the host when popups are allowed', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities: {}, hostContext: {} }
        : undefined,
    );
    const opened: string[] = [];
    const realOpen = window.open;
    window.open = ((url: string) => {
      opened.push(url);
      return {} as Window;
    }) as typeof window.open;
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.openLink(LINK, 100)).resolves.toBe(true);
      expect(opened).toEqual([LINK]);
      // The host is never consulted on this path.
      expect(host.sent.some((m) => m.method === 'ui/open-link')).toBe(false);
    } finally {
      window.open = realOpen;
      host.restore();
    }
  });

  it('asks the host when the sandbox blocks window.open', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        return { hostCapabilities: {}, hostContext: {} };
      }
      if (msg.method === 'ui/open-link') return {};
      return undefined;
    });
    const realOpen = window.open;
    // A sandboxed iframe without allow-popups returns null.
    window.open = (() => null) as typeof window.open;
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.openLink(LINK, 500)).resolves.toBe(true);
      const msg = host.sent.find((m) => m.method === 'ui/open-link');
      expect(msg?.params).toEqual({ url: LINK });
    } finally {
      window.open = realOpen;
      host.restore();
    }
  });

  it('reports failure when neither route can open it', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities: {}, hostContext: {} }
        : undefined,
    );
    const realOpen = window.open;
    window.open = (() => null) as typeof window.open;
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      // ui/open-link unanswered: the spec says hosts SHOULD implement it, so
      // this is conformant and the caller has to cope with false.
      await expect(bridge.openLink(LINK, 100)).resolves.toBe(false);
    } finally {
      window.open = realOpen;
      host.restore();
    }
  });

  it('reports requested widget dimensions to the host', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        return { hostCapabilities: {}, hostContext: {} };
      }
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      bridge.reportSize(640, 420);
      const msg = host.sent.find(
        (m) => m.method === 'ui/notifications/size-changed',
      );
      expect(msg?.params).toEqual({ width: 640, height: 420 });
    } finally {
      host.restore();
    }
  });
});

// `serverTools` is the spec's HostCapabilities key for "host can proxy tool
// calls to the MCP server". Reading only the pre-spec guesses made every
// conformant host report tools=no, which silently disabled click-to-drill in
// BOTH hosts we tested — it looked like hosts forbade tool calls when in fact
// we were not reading the name the spec defines.
describe('capability derivation', () => {
  async function capsFrom(hostCapabilities: Record<string, unknown>) {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities, hostContext: {} }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      return await bridge.initialize(500);
    } finally {
      host.restore();
    }
  }

  it('recognises the spec-defined `serverTools` capability', async () => {
    const init = await capsFrom({ serverTools: {} });
    expect(init.capabilities.canCallTools).toBe(true);
  });

  it('still recognises the pre-spec spellings', async () => {
    expect((await capsFrom({ tools: {} })).capabilities.canCallTools).toBe(true);
    expect((await capsFrom({ toolCalls: {} })).capabilities.canCallTools).toBe(
      true,
    );
  });

  it('reports tools unsupported when the host advertises none of them', async () => {
    const init = await capsFrom({ openLinks: {} });
    expect(init.capabilities.canCallTools).toBe(false);
  });

  it('surfaces the raw capability keys and sandbox grants for diagnosis', async () => {
    const init = await capsFrom({
      serverTools: {},
      openLinks: {},
      sandbox: { permissions: { clipboardWrite: {} } },
    });
    expect(init.diagnostics.capabilityKeys).toEqual([
      'serverTools',
      'openLinks',
      'sandbox',
    ]);
    expect(init.diagnostics.sandboxPermissions).toEqual(['clipboardWrite']);
  });
});

describe('pip display mode', () => {
  it('declares all three modes so a host may offer pip', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities: {}, hostContext: {} }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      const init = host.sent.find((m) => m.method === 'ui/initialize');
      expect(
        (init?.params.appCapabilities as { availableDisplayModes: string[] })
          .availableDisplayModes,
      ).toEqual(['inline', 'fullscreen', 'pip']);
    } finally {
      host.restore();
    }
  });

  it('reports pip unsupported when the host lists modes without it', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? {
            hostCapabilities: {},
            hostContext: { availableDisplayModes: ['inline', 'fullscreen'] },
          }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      expect(bridge.supportsDisplayMode('pip')).toBe(false);
      expect(bridge.supportsDisplayMode('fullscreen')).toBe(true);
      // ...and never asks for it, so no control can hang on a timeout.
      await expect(bridge.requestDisplayMode('pip', 5000)).resolves.toBeNull();
      expect(host.sent.some((m) => m.method === 'ui/request-display-mode')).toBe(
        false,
      );
    } finally {
      host.restore();
    }
  });

  it('treats an unstated mode list as "might work", not "no"', async () => {
    // A host that advertises nothing tells us nothing; requesting is harmless
    // and a wrong "no" would hide a working feature.
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities: {}, hostContext: {} }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      expect(bridge.supportsDisplayMode('pip')).toBe(true);
    } finally {
      host.restore();
    }
  });

  it('accepts pip as a granted mode', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize')
        return {
          hostCapabilities: {},
          hostContext: { availableDisplayModes: ['inline', 'pip'] },
        };
      if (msg.method === 'ui/request-display-mode') return { mode: 'pip' };
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.requestDisplayMode('pip', 500)).resolves.toBe('pip');
    } finally {
      host.restore();
    }
  });
});

it('picks up display modes announced after the handshake', async () => {
  // host-context-changed carries a full HostContext per the spec, so a host
  // may advertise its modes late. Reading them only at initialize made a host
  // that enables pip mid-session look identical to one that never supports
  // it — the same "capability read as absent" failure as serverTools.
  const host = withFakeHost((msg) =>
    msg.method === 'ui/initialize'
      ? {
          hostCapabilities: {},
          hostContext: { availableDisplayModes: ['inline', 'fullscreen'] },
        }
      : undefined,
  );
  try {
    const bridge = new ChartBridge();
    await bridge.initialize(500);
    expect(bridge.supportsDisplayMode('pip')).toBe(false);

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          jsonrpc: '2.0',
          method: 'ui/notifications/host-context-changed',
          params: { availableDisplayModes: ['inline', 'fullscreen', 'pip'] },
        },
      }),
    );
    expect(bridge.supportsDisplayMode('pip')).toBe(true);
    expect(bridge.getDiagnostics().availableDisplayModes).toContain('pip');
  } finally {
    host.restore();
  }
});

// Claude Desktop's real handshake, transcribed from the diagnostics panel.
// It advertises openLinks and downloadFile — dedicated host-mediated routes
// the widget never used, while it fought the sandbox with window.open and an
// <a download> click. Both features were dead for exactly this reason, which
// is the serverTools defect again: a capability offered under a name we never
// read. It also advertises availableDisplayModes: ["inline"] ONLY.
const DESKTOP_CAPS = {
  openLinks: {},
  downloadFile: {},
  serverTools: {},
  serverResources: {},
  logging: {},
  updateModelContext: { text: {}, image: {} },
  message: { text: {} },
  sandbox: { csp: { connectDomains: [], resourceDomains: [], frameDomains: [], baseUriDomains: [] } },
};

function desktopHost(extra?: (msg: Captured) => Record<string, unknown> | undefined) {
  return withFakeHost((msg) => {
    if (msg.method === 'ui/initialize') {
      return {
        protocolVersion: '2026-01-26',
        hostCapabilities: DESKTOP_CAPS,
        hostContext: { availableDisplayModes: ['inline'], displayMode: 'inline' },
      };
    }
    return extra?.(msg);
  });
}

describe('Claude Desktop capabilities', () => {
  it('reads openLinks and downloadFile from the real handshake', async () => {
    const host = desktopHost();
    try {
      const bridge = new ChartBridge();
      const init = await bridge.initialize(500);
      expect(init.capabilities.canOpenLinks).toBe(true);
      expect(init.capabilities.canDownloadFile).toBe(true);
      expect(init.capabilities.canCallTools).toBe(true);
    } finally {
      host.restore();
    }
  });

  it('downloads through the host rather than the blocked browser path', async () => {
    const host = desktopHost((msg) =>
      msg.method === 'ui/download-file' ? {} : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.downloadViaHost('d.csv', 'text/csv', 'a,b')).resolves.toBe(true);
      const req = host.sent.find((m) => m.method === 'ui/download-file');
      const contents = (req?.params as { contents: Array<Record<string, unknown>> }).contents;
      expect(contents[0]).toEqual({
        type: 'resource',
        resource: { uri: 'file:///d.csv', mimeType: 'text/csv', text: 'a,b' },
      });
    } finally {
      host.restore();
    }
  });

  it('treats a host refusal as a failed save, not a success', async () => {
    // The host reports refusal and user cancellation the same way.
    const host = desktopHost((msg) =>
      msg.method === 'ui/download-file' ? { isError: true } : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(
        bridge.downloadViaHost('d.csv', 'text/csv', 'x', 200),
      ).resolves.toBe(false);
    } finally {
      host.restore();
    }
  });

  it('asks the host to open a link before touching window.open', async () => {
    const host = desktopHost((msg) =>
      msg.method === 'ui/open-link' ? {} : undefined,
    );
    const realOpen = window.open;
    let openCalled = false;
    window.open = (() => { openCalled = true; return null; }) as typeof window.open;
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.openLink('https://x/e', 500)).resolves.toBe(true);
      expect(host.sent.some((m) => m.method === 'ui/open-link')).toBe(true);
      expect(openCalled).toBe(false);
    } finally {
      window.open = realOpen;
      host.restore();
    }
  });

  // Desktop advertises ["inline"] only — no fullscreen. Maximize must still
  // work via the widget's own grow-in-place path; gating it off would be a
  // regression in a control Amin already relies on.
  it('still supports maximize when the host advertises inline only', async () => {
    const host = desktopHost();
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      expect(bridge.supportsDisplayMode('pip')).toBe(false);
      expect(bridge.supportsDisplayMode('fullscreen')).toBe(false);
      // Skipped without a round trip, so the fallback runs immediately rather
      // than after a timeout.
      await expect(bridge.requestDisplayMode('fullscreen', 5000)).resolves.toBeNull();
      expect(host.sent.some((m) => m.method === 'ui/request-display-mode')).toBe(false);
    } finally {
      host.restore();
    }
  });
});

describe('host refusal is not success', () => {
  // McpUiOpenLinkResult.isError: "True if the host failed to open the URL
  // (e.g., due to security policy)". The promise still RESOLVES. Treating that
  // as success returned true, skipped every fallback, and left the user with
  // silence — matching "open in superset does nothing" exactly.
  it('treats an isError open-link result as a failure', async () => {
    const host = desktopHost((msg) =>
      msg.method === 'ui/open-link' ? { isError: true } : undefined,
    );
    const realOpen = window.open;
    window.open = (() => null) as typeof window.open;
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(bridge.openLink('https://x/e', 300)).resolves.toBe(false);
    } finally {
      window.open = realOpen;
      host.restore();
    }
  });

  it('records what we sent and what came back, for both operations', async () => {
    // Three cycles were spent inferring backwards from "it does nothing",
    // because the host's answer is invisible from outside the iframe.
    const host = desktopHost((msg) => {
      if (msg.method === 'ui/open-link') return { isError: true };
      if (msg.method === 'ui/download-file') return { isError: true };
      return undefined;
    });
    const realOpen = window.open;
    window.open = (() => null) as typeof window.open;
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await bridge.downloadViaHost('d.csv', 'text/csv', 'a,b');
      await bridge.openLink('https://x/e', 300);
      const ex = bridge.getDiagnostics().exchanges;
      const dl = ex.find((e) => e.method === 'ui/download-file');
      expect(dl?.result).toEqual({ isError: true });
      expect(dl?.params).toHaveProperty('contents');
      expect(ex.some((e) => e.method === 'ui/open-link')).toBe(true);
    } finally {
      window.open = realOpen;
      host.restore();
    }
  });

  it('records a silent host as a failure rather than nothing', async () => {
    const host = desktopHost(); // never answers ui/download-file
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await expect(
        bridge.downloadViaHost('d.csv', 'text/csv', 'x', 200),
      ).resolves.toBe(false);
      const dl = bridge.getDiagnostics().exchanges.find(
        (e) => e.method === 'ui/download-file',
      );
      expect(dl?.failure).toBeTruthy();
    } finally {
      host.restore();
    }
  });

  it('reads the host-stated frame ceiling instead of our guess', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? {
            hostCapabilities: {},
            hostContext: { containerDimensions: { width: 768, maxHeight: 5000 } },
          }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      expect(bridge.getHostMaxHeight()).toBe(5000);
    } finally {
      host.restore();
    }
  });
});

describe('failure reporting through the model context', () => {
  // Every capability question on this branch cost multiple round trips because
  // the host's answer lives only inside the iframe, so diagnosing it needed a
  // person to read JSON off a screen. The host advertises updateModelContext,
  // so the widget hands the detail to the assistant directly.
  it('reports a declined operation, with what was sent and returned', async () => {
    const host = desktopHost((msg) => {
      if (msg.method === 'ui/download-file') return { isError: true };
      if (msg.method === 'ui/update-model-context') return {};
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await bridge.downloadViaHost('chart.csv', 'text/csv', 'a,b', 300);
      const report = host.sent.find((m) => m.method === 'ui/update-model-context');
      expect(report).toBeTruthy();
      const text = JSON.stringify(report?.params);
      expect(text).toContain('ui/download-file');
      expect(text).toContain('isError');
      // The params we sent must be in there — that is the thing under suspicion.
      expect(text).toContain('file:///chart.csv');
    } finally {
      host.restore();
    }
  });

  it('reports each operation once, so a retry cannot flood the context', async () => {
    const host = desktopHost((msg) => {
      if (msg.method === 'ui/download-file') return { isError: true };
      if (msg.method === 'ui/update-model-context') return {};
      return undefined;
    });
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await bridge.downloadViaHost('a.csv', 'text/csv', 'x', 300);
      await bridge.downloadViaHost('b.csv', 'text/csv', 'y', 300);
      await bridge.downloadViaHost('c.csv', 'text/csv', 'z', 300);
      const reports = host.sent.filter(
        (m) => m.method === 'ui/update-model-context',
      );
      expect(reports).toHaveLength(1);
    } finally {
      host.restore();
    }
  });

  it('does not recurse when the report itself is refused', async () => {
    // A report that failed and then reported its own failure would loop. Two
    // things prevent it: updateModelContext sends via `request` rather than
    // `requestOk`, so it never reaches the reporter at all, and the reporter
    // also skips that method explicitly. Assert the exact count — an earlier
    // version of this test used `<= 1`, which passed with BOTH guards removed
    // and so proved nothing.
    const host = desktopHost((msg) =>
      msg.method === 'ui/update-model-context' ? { isError: true } : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await bridge.downloadViaHost('a.csv', 'text/csv', 'x', 200);
      const reports = host.sent.filter(
        (m) => m.method === 'ui/update-model-context',
      );
      expect(reports).toHaveLength(1);
    } finally {
      host.restore();
    }
  });

  it('stays silent when the host cannot take context updates', async () => {
    const host = withFakeHost((msg) =>
      msg.method === 'ui/initialize'
        ? { hostCapabilities: { downloadFile: {} }, hostContext: {} }
        : undefined,
    );
    try {
      const bridge = new ChartBridge();
      await bridge.initialize(500);
      await bridge.downloadViaHost('a.csv', 'text/csv', 'x', 200);
      expect(
        host.sent.some((m) => m.method === 'ui/update-model-context'),
      ).toBe(false);
    } finally {
      host.restore();
    }
  });
});
