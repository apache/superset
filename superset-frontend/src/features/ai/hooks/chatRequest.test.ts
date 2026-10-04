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

import {
  ChatRequestAbortedError,
  ChatStreamEventError,
  ChatStreamTimeoutError,
  DEFAULT_AGENT_KEY,
  DEFAULT_CHAT_AGENT,
  describeToolCall,
  extractThinkingText,
  loadStoredAgentKey,
  normalizeChatAgents,
  parseSseEvents,
  streamRun,
} from './chatRequest';
import type { AiToolCall } from '../types';

/** Builds a body that yields the given chunks, one read at a time. */
const streamOf = (chunks: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();
  let index = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (index >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[index]));
      index += 1;
    },
  });
};

const frame = (event: string, payload: unknown): string =>
  `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;

const mockStream = (chunks: string[], ok = true) => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok,
    status: ok ? 200 : 500,
    body: streamOf(chunks),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
};

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test('parseSseEvents keeps a frame that is split across reads', () => {
  const first = parseSseEvents('event: thoughts\ndata: {"delta":"he');
  expect(first.events).toHaveLength(0);

  const second = parseSseEvents(`${first.remainder}llo"}\n\n`);
  expect(second.events).toEqual([
    { event: 'thoughts', data: '{"delta":"hello"}' },
  ]);
  expect(second.remainder).toBe('');
});

test('parseSseEvents ignores keep-alive comments', () => {
  const { events } = parseSseEvents(
    `: keepalive\n\n${frame('done', {
      ok: true,
    })}`,
  );

  expect(events).toEqual([{ event: 'done', data: '{"ok":true}' }]);
});

test('extractThinkingText renders each shape the backend emits as one line', () => {
  expect(extractThinkingText({ delta: 'partial' })).toBe('partial');
  // The stage is a protocol value, not prose. It used to be prefixed onto the
  // line, which put "start - Working on your question" in front of the user.
  expect(extractThinkingText({ stage: 'tool', message: 'Running query' })).toBe(
    'Running query',
  );
  expect(
    extractThinkingText({
      stage: 'tool',
      message: 'Ran',
      meta: { tool_name: 'run_sql', duration_ms: 42 },
    }),
  ).toBe('Ran — run_sql (42ms)');
  expect(extractThinkingText({})).toBeNull();
});

test('streamRun returns the final content and reports the run finished', async () => {
  mockStream([
    frame('session', { thread_uuid: 't', message_uuid: 'm' }),
    frame('assistant_delta', { delta: 'par' }),
    frame('assistant_delta', { delta: 'tial' }),
    frame('final', { role: 'assistant', content: 'the answer' }),
    frame('done', { ok: true }),
  ]);
  const deltas: string[] = [];
  let sessionMessage: string | undefined;

  const result = await streamRun({
    threadUuid: 'thread-1',
    runId: 'run-1',
    onSession: uuid => {
      sessionMessage = uuid;
    },
    onAssistantDelta: delta => deltas.push(delta),
  });

  expect(sessionMessage).toBe('m');
  expect(deltas).toEqual(['par', 'tial']);
  // The final frame replaces the accumulated deltas rather than appending.
  expect(result.content).toBe('the answer');
  expect(result.cancelled).toBe(false);
});

test('streamRun surfaces an error frame as a ChatStreamEventError', async () => {
  mockStream([
    frame('error', { error: 'the warehouse refused the query' }),
    frame('done', { ok: false }),
  ]);

  await expect(
    streamRun({ threadUuid: 'thread-1', runId: 'run-1' }),
  ).rejects.toThrow(ChatStreamEventError);
});

test('a final frame retracts provisional text before an error is raised', async () => {
  mockStream([
    frame('assistant_delta', { delta: 'Let me check another table.' }),
    frame('error', { error: 'The step limit was reached.' }),
    frame('final', { content: 'No final answer was produced.' }),
    frame('done', { ok: false }),
  ]);
  const finals: string[] = [];

  await expect(
    streamRun({
      threadUuid: 'thread-1',
      runId: 'run-1',
      onAssistantFinal: content => finals.push(content),
    }),
  ).rejects.toThrow(ChatStreamEventError);
  expect(finals).toEqual(['No final answer was produced.']);
});

test('streamRun reports a body that ends without the terminal frame', async () => {
  mockStream([frame('assistant_delta', { delta: 'half an answer' })]);

  // Returning the partial answer as if it were complete would present it as the
  // assistant's conclusion.
  await expect(
    streamRun({ threadUuid: 'thread-1', runId: 'run-1' }),
  ).rejects.toThrow(ChatStreamEventError);
});

test('streamRun reports a cancelled run without treating it as a failure', async () => {
  mockStream([
    frame('assistant_delta', { delta: 'as far as I got' }),
    frame('cancelled', {}),
    frame('done', { ok: false }),
  ]);

  const result = await streamRun({ threadUuid: 'thread-1', runId: 'run-1' });

  expect(result.cancelled).toBe(true);
  expect(result.content).toBe('as far as I got');
});

test('streamRun raises ChatRequestAbortedError when the caller aborts', async () => {
  const controller = new AbortController();
  global.fetch = jest.fn().mockImplementation(() => {
    controller.abort();
    const error = new Error('aborted');
    error.name = 'AbortError';
    return Promise.reject(error);
  }) as unknown as typeof fetch;

  await expect(
    streamRun({
      threadUuid: 'thread-1',
      runId: 'run-1',
      signal: controller.signal,
    }),
  ).rejects.toThrow(ChatRequestAbortedError);
});

test('streamRun raises ChatStreamTimeoutError when the reader is cut short', async () => {
  // A body that never completes, so only the timeout can end the read.
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    body: new ReadableStream<Uint8Array>({ pull() {} }),
  }) as unknown as typeof fetch;

  await expect(
    streamRun({
      threadUuid: 'thread-1',
      runId: 'run-1',
      streamTimeoutMs: 10,
    }),
  ).rejects.toThrow(ChatStreamTimeoutError);
});

test('a checkpoint stops the reader until it is resolved', async () => {
  mockStream([
    frame('checkpoint', { summary: 'about to run three queries' }),
    frame('final', { role: 'assistant', content: 'done' }),
    frame('done', { ok: true }),
  ]);

  let release: (() => void) | undefined;
  const gateOpened = new Promise<void>(resolve => {
    release = resolve;
  });
  let sawFinal = false;

  const pending = streamRun({
    threadUuid: 'thread-1',
    runId: 'run-1',
    onCheckpoint: async checkpoint => {
      expect(checkpoint.summary).toBe('about to run three queries');
      await gateOpened;
    },
  }).then(result => {
    sawFinal = true;
    return result;
  });

  // Give the reader every chance to run ahead; it must not have finished.
  await Promise.resolve();
  await Promise.resolve();
  expect(sawFinal).toBe(false);

  release?.();
  await expect(pending).resolves.toEqual({
    content: 'done',
    cancelled: false,
  });
});

test('normalizeChatAgents puts the default first and drops duplicates', () => {
  const normalized = normalizeChatAgents([
    { key: 'sql', name: 'SQL', tools: [] },
    { key: 'sql', name: 'SQL again', tools: [] },
    { key: DEFAULT_AGENT_KEY, name: 'Standard', tools: [] },
  ]);

  expect(normalized.map(agent => agent.key)).toEqual([
    DEFAULT_AGENT_KEY,
    'sql',
  ]);
  expect(normalized[0].name).toBe('Standard');
});

test('normalizeChatAgents synthesises a default when the backend offers none', () => {
  expect(normalizeChatAgents([])).toEqual([DEFAULT_CHAT_AGENT]);
});

test('loadStoredAgentKey falls back to the default for an empty entry', () => {
  localStorage.setItem('agent-test', '   ');
  expect(loadStoredAgentKey('agent-test')).toBe(DEFAULT_AGENT_KEY);

  localStorage.setItem('agent-test', 'explore');
  expect(loadStoredAgentKey('agent-test')).toBe('explore');
});

test('describeToolCall renders a SQL step as a fenced block and a table', () => {
  const call: AiToolCall = {
    name: 'run_sql',
    ok: true,
    truncated: false,
    durationMs: 120,
    display: {
      kind: 'sql_result',
      executedSql: 'SELECT 1',
      executedSqlTruncated: false,
      columns: ['n', 'label'],
      rows: [{ n: 1, label: 'a|b' }],
      rowCount: 1,
      sampleOnly: true,
      truncated: false,
    },
  };

  const markdown = describeToolCall(call);

  expect(markdown).toContain('**run_sql**');
  expect(markdown).toContain('```sql\nSELECT 1\n```');
  expect(markdown).toContain('| n | label |');
  // A pipe in a value would otherwise break out of its cell.
  expect(markdown).toContain('| 1 | a\\|b |');
  expect(markdown).toContain('sample only');
});

test('describeToolCall marks a failed step and shows its error', () => {
  const markdown = describeToolCall({
    name: 'run_sql',
    ok: false,
    truncated: false,
    error: 'table not found',
  });

  expect(markdown).toContain('failed');
  expect(markdown).toContain('table not found');
});
