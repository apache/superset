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
  it('returns ChartData from structuredContent', () => {
    const { chartData, error } = extractToolResult({
      structuredContent: { columns: [], data: [], chart_id: 1 },
    });
    expect(error).toBeUndefined();
    expect(chartData).not.toBeNull();
    expect(chartData?.chart_id).toBe(1);
  });

  it('surfaces a Superset ChartError payload as an error (not chart data)', () => {
    const { chartData, error } = extractToolResult({
      structuredContent: { error: 'Chart not found', error_type: 'NotFound' },
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
        { type: 'text', text: JSON.stringify({ columns: [], data: [], chart_id: 9 }) },
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
  Object.defineProperty(window, 'parent', { value: fakeParent, configurable: true });
  return {
    sent,
    restore: () => Object.defineProperty(window, 'parent', { value: realParent, configurable: true }),
  };
}

describe('ChartBridge handshake contract', () => {
  it('sends appInfo in ui/initialize and treats unknown capabilities as unsupported', async () => {
    const host = withFakeHost((msg) => {
      if (msg.method === 'ui/initialize') {
        // Host advertises NO capabilities.
        return { protocolVersion: '2026-01-26', hostCapabilities: {}, hostContext: {} };
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
});
