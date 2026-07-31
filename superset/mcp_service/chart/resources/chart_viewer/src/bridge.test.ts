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
