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
  conversationReducer,
  ConversationState,
  fromPersisted,
  generateConversationId,
  newConversation,
  toPersisted,
  trimHistory,
  visibleItems,
} from './conversation';
import type { ChatEvent } from '../types';

function apply(
  state: ConversationState,
  events: ChatEvent[],
): ConversationState {
  return conversationReducer(state, { type: 'events', events });
}

function withUserMessage(content = 'hello'): ConversationState {
  return conversationReducer(newConversation('home'), {
    type: 'user_message',
    id: 'u1',
    content,
  });
}

test('an attached message keeps the file text out of the transcript', () => {
  const state = conversationReducer(newConversation('home'), {
    type: 'user_message',
    id: 'u1',
    content: 'what is in here?',
    sent: 'what is in here?\n\n<ATTACHED-FILE name="a.csv">\nx,y\n</ATTACHED-FILE>',
    attachments: [{ name: 'a.csv', truncated: false }],
    images: [{ media_type: 'image/png', data: 'AAAB', name: 'shot.png' }],
  });
  // The transcript shows the typed text; the model gets the composed form.
  expect(state.items[0]).toMatchObject({
    content: 'what is in here?',
    attachments: [{ name: 'a.csv', truncated: false }],
  });
  expect(state.history[0].content).toContain('<ATTACHED-FILE name="a.csv">');
  expect(state.history[0].images).toHaveLength(1);
});

test('images never reach persistence', () => {
  const state = conversationReducer(newConversation('home'), {
    type: 'user_message',
    id: 'u1',
    content: 'look at this',
    attachments: [{ name: 'shot.png', preview: 'data:image/png;base64,AAAB' }],
    images: [{ media_type: 'image/png', data: 'AAAB', name: 'shot.png' }],
  });
  const persisted = JSON.stringify(toPersisted(state));
  expect(persisted).not.toContain('AAAB');
  expect(persisted).not.toContain('data:image');
  // The message and the attachment's name survive.
  expect(persisted).toContain('look at this');
  expect(persisted).toContain('shot.png');
});

test('conversation ids satisfy the gateway pattern', () => {
  const id = generateConversationId();
  expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
});

test('user message enters items and history and sets sending', () => {
  const state = withUserMessage('find dashboards');
  expect(state.status).toBe('sending');
  expect(state.items).toEqual([
    { kind: 'message', id: 'u1', role: 'user', content: 'find dashboards' },
  ]);
  expect(state.history).toEqual([{ role: 'user', content: 'find dashboards' }]);
});

test('assistant message event updates items and history', () => {
  const state = apply(withUserMessage(), [
    { type: 'message.completed', id: 'm1', content: 'Hi there' },
    { type: 'request.completed' },
  ]);
  expect(state.status).toBe('idle');
  expect(state.items[1]).toEqual({
    kind: 'message',
    id: 'm1',
    role: 'assistant',
    content: 'Hi there',
  });
  expect(state.history[1]).toEqual({ role: 'assistant', content: 'Hi there' });
});

test('tool completion reconstructs the assistant tool-call exchange', () => {
  const state = apply(withUserMessage('list dashboards'), [
    {
      type: 'tool.running',
      id: 'tc1',
      tool: 'list_dashboards',
      arguments: { request: { limit: 5 } },
    },
    {
      type: 'tool.completed',
      id: 'tc1',
      tool: 'list_dashboards',
      result: '{"count": 1}',
      truncated: false,
    },
    { type: 'message.completed', id: 'm1', content: 'One dashboard.' },
    { type: 'request.completed' },
  ]);
  const tool = state.items[1];
  expect(tool).toMatchObject({
    kind: 'tool',
    id: 'tc1',
    tool: 'list_dashboards',
    status: 'succeeded',
    result: '{"count": 1}',
  });
  expect(state.history).toEqual([
    { role: 'user', content: 'list dashboards' },
    {
      role: 'assistant',
      content: '',
      tool_calls: [
        {
          id: 'tc1',
          name: 'list_dashboards',
          arguments: { request: { limit: 5 } },
        },
      ],
    },
    {
      role: 'tool',
      tool_call_id: 'tc1',
      name: 'list_dashboards',
      content: '{"count": 1}',
    },
    { role: 'assistant', content: 'One dashboard.' },
  ]);
});

test('assistant text preceding a tool call merges into one history entry', () => {
  const state = apply(withUserMessage('delete it'), [
    { type: 'message.completed', id: 'm1', content: 'Running the tool now.' },
    {
      type: 'tool.running',
      id: 'tc1',
      tool: 'list_dashboards',
      arguments: {},
    },
    {
      type: 'tool.completed',
      id: 'tc1',
      tool: 'list_dashboards',
      result: 'ok',
      truncated: false,
    },
    { type: 'request.completed' },
  ]);
  // No consecutive assistant messages: the tool call attaches to the text.
  expect(state.history[1]).toEqual({
    role: 'assistant',
    content: 'Running the tool now.',
    tool_calls: [{ id: 'tc1', name: 'list_dashboards', arguments: {} }],
  });
  expect(state.history[2].role).toBe('tool');
});

test('approval_required pauses without touching history', () => {
  const state = apply(withUserMessage('delete dashboard 42'), [
    {
      type: 'tool.approval_required',
      id: 'tc1',
      tool: 'delete_dashboard',
      tool_title: 'Delete dashboard',
      arguments: { request: { identifier: 42 } },
      classification: 'destructive',
      approval_id: 'appr-1',
      expires_at: '2100-01-01T00:00:00',
      reversible: false,
      warnings: ['This action is classified as destructive.'],
    },
  ]);
  expect(state.status).toBe('idle');
  expect(state.pending).toMatchObject({
    approvalId: 'appr-1',
    tool: 'delete_dashboard',
    classification: 'destructive',
  });
  // History still ends at the user message; the pending assistant tool-call
  // message is reconstructed server-side from the approval payload.
  expect(state.history).toEqual([
    { role: 'user', content: 'delete dashboard 42' },
  ]);
  expect(state.items[1]).toMatchObject({
    kind: 'tool',
    status: 'awaiting_approval',
  });
});

test('rejection records the structured rejection result', () => {
  let state = apply(withUserMessage('delete dashboard 42'), [
    {
      type: 'tool.approval_required',
      id: 'tc1',
      tool: 'delete_dashboard',
      tool_title: null,
      arguments: { request: { identifier: 42 } },
      classification: 'destructive',
      approval_id: 'appr-1',
      expires_at: '2100-01-01T00:00:00',
      reversible: false,
      warnings: [],
    },
  ]);
  state = conversationReducer(state, { type: 'approval_submitted' });
  expect(state.pending).toBeNull();
  state = apply(state, [
    { type: 'tool.rejected', id: 'tc1', tool: 'delete_dashboard' },
    { type: 'message.completed', id: 'm1', content: 'Understood.' },
    { type: 'request.completed' },
  ]);
  expect(state.items[1]).toMatchObject({ kind: 'tool', status: 'rejected' });
  const toolMessage = state.history.find(message => message.role === 'tool');
  expect(toolMessage?.content).toContain('rejected');
});

test('hiding tool activity leaves the conversation itself untouched', () => {
  const state = apply(withUserMessage('list dashboards'), [
    {
      type: 'tool.completed',
      id: 'tc1',
      tool: 'list_dashboards',
      result: '{"count": 2}',
      truncated: false,
    },
    { type: 'message.completed', id: 'm1', content: 'Two dashboards.' },
    { type: 'request.completed' },
  ]);
  expect(visibleItems(state.items, true)).toEqual(state.items);
  expect(visibleItems(state.items, false)).toEqual([
    state.items[0],
    state.items[2],
  ]);
  // The model still learns the tool ran, however the transcript reads.
  expect(state.history.some(message => message.role === 'tool')).toBe(true);
});

test('a failed tool stays visible with tool activity hidden', () => {
  const state = apply(withUserMessage('delete dashboard 42'), [
    {
      type: 'tool.failed',
      id: 'tc1',
      tool: 'delete_dashboard',
      error: 'Not found',
    },
  ]);
  expect(visibleItems(state.items, false)).toEqual(state.items);
});

test('a gated tool stays visible however the mode was reported', () => {
  // The gateway decides what is gated, so a card the user must act on is
  // never dropped on the strength of a configuration value.
  const state = apply(withUserMessage('delete dashboard 42'), [
    {
      type: 'tool.approval_required',
      id: 'tc1',
      tool: 'delete_dashboard',
      tool_title: null,
      arguments: {},
      classification: 'destructive',
      approval_id: 'appr-1',
      expires_at: '2100-01-01T00:00:00',
      reversible: false,
      warnings: [],
    },
  ]);
  expect(visibleItems(state.items, false)).toEqual(state.items);
  const rejected = apply(state, [
    { type: 'tool.rejected', id: 'tc1', tool: 'delete_dashboard' },
  ]);
  expect(visibleItems(rejected.items, false)).toEqual(rejected.items);
});

test('request.failed surfaces the error without losing items', () => {
  const state = apply(withUserMessage(), [
    { type: 'request.failed', error_code: 'X', message: 'Provider broke' },
  ]);
  expect(state.status).toBe('idle');
  expect(state.error).toBe('Provider broke');
  expect(state.items).toHaveLength(1);
});

test('history trimming keeps the window starting at a user message', () => {
  const long = Array.from({ length: 80 }, (_, index) => ({
    role: (index % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
    content: `m${index}`,
  }));
  const trimmed = trimHistory(long);
  expect(trimmed.length).toBeLessThanOrEqual(60);
  expect(trimmed[0].role).toBe('user');
});

test('persistence round-trip drops pending approvals and caps size', () => {
  let state = withUserMessage('x'.repeat(150_000));
  state = apply(state, [
    { type: 'message.completed', id: 'm1', content: 'y'.repeat(150_000) },
    {
      type: 'tool.approval_required',
      id: 'tc1',
      tool: 'delete_dashboard',
      tool_title: null,
      arguments: {},
      classification: 'destructive',
      approval_id: 'appr-1',
      expires_at: '2100-01-01T00:00:00',
      reversible: false,
      warnings: [],
    },
  ]);
  const persisted = toPersisted(state);
  expect(JSON.stringify(persisted).length).toBeLessThanOrEqual(210_000);
  const restored = fromPersisted(persisted);
  expect(restored.pending).toBeNull();
  expect(restored.status).toBe('idle');
  expect(restored.conversationId).toBe(state.conversationId);
});

function navigate(
  state: ConversationState,
  to: string,
  href: string,
  fromLabel: string,
  fromHref: string,
): ConversationState {
  return conversationReducer(state, {
    type: 'page_changed',
    noteId: `note-${to}`,
    note: `You navigated to ${to}.`,
    href,
    back: { href: fromHref, label: `Back to ${fromLabel}` },
  });
}

function notes(state: ConversationState) {
  return state.items.filter(item => item.kind === 'note');
}

test('consecutive navigation without messages collapses to one note', () => {
  let state = apply(newConversation('dashboard'), [
    { type: 'message.completed', id: 'm1', content: 'hi' },
  ]);

  state = navigate(
    state,
    'Charts',
    '/chart/list/',
    'Dashboard',
    '/dashboard/1/',
  );
  state = navigate(
    state,
    'Dashboards',
    '/dashboard/list/',
    'Charts',
    '/chart/list/',
  );
  state = navigate(
    state,
    'SQL Lab',
    '/sqllab',
    'Dashboards',
    '/dashboard/list/',
  );

  // One note, showing the latest page but still pointing at the place the
  // conversation actually happened.
  const remaining = notes(state);
  expect(remaining).toHaveLength(1);
  expect(remaining[0]).toMatchObject({
    content: 'You navigated to SQL Lab.',
    back: { href: '/dashboard/1/', label: 'Back to Dashboard' },
  });
  // The message above the note is untouched.
  expect(state.items[0]).toMatchObject({ kind: 'message', content: 'hi' });
});

test('a new note starts once the conversation continues elsewhere', () => {
  let state = apply(newConversation('dashboard'), [
    { type: 'message.completed', id: 'm1', content: 'hi' },
  ]);
  state = navigate(
    state,
    'Charts',
    '/chart/list/',
    'Dashboard',
    '/dashboard/1/',
  );
  state = conversationReducer(state, {
    type: 'user_message',
    id: 'u2',
    content: 'another question',
  });
  state = navigate(state, 'SQL Lab', '/sqllab', 'Charts', '/chart/list/');

  const remaining = notes(state);
  expect(remaining).toHaveLength(2);
  expect(remaining[1]).toMatchObject({
    back: { href: '/chart/list/', label: 'Back to Charts' },
  });
});

test('returning to where the messages are removes the note', () => {
  let state = apply(newConversation('dashboard'), [
    { type: 'message.completed', id: 'm1', content: 'hi' },
  ]);
  state = navigate(
    state,
    'Charts',
    '/chart/list/',
    'Dashboard',
    '/dashboard/1/',
  );
  expect(notes(state)).toHaveLength(1);

  state = navigate(
    state,
    'Dashboard',
    '/dashboard/1/',
    'Charts',
    '/chart/list/',
  );
  expect(notes(state)).toHaveLength(0);
  expect(state.items).toHaveLength(1);
});
