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
import React from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { chat } from '@apache-superset/core';
import { __testing } from '../../test/coreMock';
import ChatPanel from './ChatPanel';
import type { AiChatConfig, ChatEvent } from '../types';

const ENABLED_CONFIG: AiChatConfig = {
  enabled: true,
  provider: 'mock',
  provider_configured: true,
  mcp_available: true,
  // The instance's default. Every approval test below still drives the
  // approval UI, because it is the events that put it on screen.
  tool_approval_mode: 'disabled',
  tools: [
    {
      name: 'list_dashboards',
      title: 'List dashboards',
      classification: 'read_only',
    },
    {
      name: 'delete_dashboard',
      title: 'Delete dashboard',
      classification: 'destructive',
    },
  ],
  limits: { max_messages_per_request: 80, max_input_chars: 100_000 },
};

/** An instance that gates something, and so reports what its tools did. */
const SUPERVISED_CONFIG: AiChatConfig = {
  ...ENABLED_CONFIG,
  tool_approval_mode: 'mutations_only',
};

interface FetchCall {
  url: string;
  init?: RequestInit;
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

let fetchCalls: FetchCall[];

function mockFetch(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
) {
  fetchCalls = [];
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    fetchCalls.push({ url, init });
    return handler(url, init);
  });
  Object.defineProperty(globalThis, 'fetch', {
    writable: true,
    configurable: true,
    value: mock,
  });
  return mock;
}

function mockConfigAndChat(
  config: AiChatConfig,
  chatEvents: ChatEvent[] | (() => ChatEvent[]),
  approvalEvents: ChatEvent[] = [],
) {
  return mockFetch(url => {
    if (url.endsWith('/config')) {
      return jsonResponse({ result: config });
    }
    if (url.endsWith('/chat')) {
      const events =
        typeof chatEvents === 'function' ? chatEvents() : chatEvents;
      return jsonResponse({
        result: { conversation_id: 'conv_x', events },
      });
    }
    if (url.endsWith('/tool_approval')) {
      return jsonResponse({
        result: { conversation_id: 'conv_x', events: approvalEvents },
      });
    }
    return jsonResponse({ message: 'not found' }, 404);
  });
}

function lastBody(): Record<string, unknown> {
  const call = fetchCalls[fetchCalls.length - 1];
  return JSON.parse(String(call.init?.body));
}

beforeEach(() => {
  __testing.reset();
});

test('shows an admin-friendly disabled state', async () => {
  mockConfigAndChat({ ...ENABLED_CONFIG, enabled: false, provider: null }, []);
  render(<ChatPanel />);
  expect(await screen.findByTestId('chat-disabled-alert')).toBeInTheDocument();
  expect(screen.getByTestId('chat-input')).toBeDisabled();
});

test('shows a misconfigured-provider state', async () => {
  mockConfigAndChat({ ...ENABLED_CONFIG, provider_configured: false }, []);
  render(<ChatPanel />);
  expect(
    await screen.findByTestId('chat-misconfigured-alert'),
  ).toBeInTheDocument();
  expect(screen.getByTestId('chat-input')).toBeDisabled();
});

test('welcome state adapts suggestions to the current page', async () => {
  __testing.setPage('dashboard');
  mockConfigAndChat(ENABLED_CONFIG, []);
  render(<ChatPanel />);
  expect(await screen.findByTestId('chat-welcome')).toBeInTheDocument();
  expect(
    screen.getByText('Explain how this dashboard is structured.'),
  ).toBeInTheDocument();
});

test('sends a message with CSRF and page context, renders the reply', async () => {
  __testing.setPage('dashboard_list');
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Here are **results**.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  await userEvent.type(input, 'find dashboards{Enter}');

  expect(await screen.findByTestId('chat-message-user')).toHaveTextContent(
    'find dashboards',
  );
  const assistant = await screen.findByTestId('chat-message-assistant');
  expect(assistant).toHaveTextContent('Here are results.');
  // Markdown rendered as elements, not injected HTML.
  expect(assistant.querySelector('strong')).toHaveTextContent('results');

  const body = lastBody();
  expect(body.conversation_id).toEqual(expect.any(String));
  expect(body.context).toEqual({ page: 'dashboard_list' });
  const chatCall = fetchCalls.find(call => call.url.endsWith('/chat'));
  expect(
    (chatCall?.init?.headers as Record<string, string>)['X-CSRFToken'],
  ).toBe('test-csrf-token');
});

test('shows loading state while a request is in flight and cancels it', async () => {
  mockFetch((url, init) => {
    if (url.endsWith('/config')) {
      return jsonResponse({ result: ENABLED_CONFIG });
    }
    // Stay pending until aborted, then reject like real fetch does.
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener('abort', () => {
        reject(new DOMException('The operation was aborted.', 'AbortError'));
      });
    });
  });
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'hello{Enter}');

  expect(await screen.findByText('Thinking…')).toBeInTheDocument();
  await userEvent.click(screen.getByTestId('chat-cancel'));
  expect(await screen.findByText('Request cancelled.')).toBeInTheDocument();
  expect(screen.queryByText('Thinking…')).not.toBeInTheDocument();
});

const READ_ONLY_TURN: ChatEvent[] = [
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
    result: '{"count": 2}',
    truncated: false,
  },
  { type: 'message.completed', id: 'm1', content: 'Two dashboards.' },
  { type: 'request.completed' },
];

test('renders tool activity where tool calls are supervised', async () => {
  mockConfigAndChat(SUPERVISED_CONFIG, READ_ONLY_TURN);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'list dashboards{Enter}');

  const card = await screen.findByTestId('tool-call-list_dashboards');
  expect(card).toHaveTextContent('list dashboards');
  expect(card).toHaveTextContent('Succeeded');
});

test('hides tool activity where nothing is gated', async () => {
  mockConfigAndChat(ENABLED_CONFIG, READ_ONLY_TURN);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'list dashboards{Enter}');

  expect(await screen.findByText('Two dashboards.')).toBeInTheDocument();
  expect(screen.queryByTestId('tool-call-list_dashboards')).toBeNull();

  // Hidden from the transcript, not from the model: the next turn replays
  // what the tool returned.
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeEnabled());
  await userEvent.type(screen.getByTestId('chat-input'), 'and charts?{Enter}');
  await waitFor(() => {
    const messages = lastBody().messages as { role: string }[];
    expect(messages.filter(message => message.role === 'tool')).toHaveLength(1);
  });
});

test('a failed tool is reported even where activity is hidden', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    {
      type: 'tool.failed',
      id: 'tc1',
      tool: 'list_dashboards',
      error: 'Upstream timed out',
    },
    { type: 'message.completed', id: 'm1', content: 'I could not check.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'list dashboards{Enter}');

  const card = await screen.findByTestId('tool-call-list_dashboards');
  expect(card).toHaveTextContent('Failed');
});

const APPROVAL_EVENT: ChatEvent = {
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
};

test('a directly executed tool renders without any approval controls', async () => {
  // What the default mode produces: no approval event, so nothing to decide.
  mockConfigAndChat(ENABLED_CONFIG, [
    {
      type: 'tool.running',
      id: 'tc1',
      tool: 'delete_dashboard',
      arguments: { request: { identifier: 42 } },
    },
    {
      type: 'tool.completed',
      id: 'tc1',
      tool: 'delete_dashboard',
      result: '{"deleted": true}',
      truncated: false,
    },
    { type: 'message.completed', id: 'm1', content: 'Deleted.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'delete dashboard 42{Enter}');

  expect(await screen.findByText('Deleted.')).toBeInTheDocument();
  expect(screen.queryByTestId('approval-card')).toBeNull();
  expect(screen.queryByTestId('approval-approve')).toBeNull();
  // The composer is never blocked waiting on a decision nobody was asked for.
  expect(screen.getByTestId('chat-input')).toBeEnabled();
});

test('the reported approval mode does not decide what is gated', async () => {
  // The config says approval is disabled, yet the backend sent an approval
  // event. The card appears: the browser follows events, and a config value
  // it could have tampered with locally is not a way around the gate.
  mockConfigAndChat(
    { ...ENABLED_CONFIG, tool_approval_mode: 'disabled' },
    [APPROVAL_EVENT],
    [{ type: 'request.completed' }],
  );
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'delete dashboard 42{Enter}');

  expect(await screen.findByTestId('approval-card')).toBeInTheDocument();
  expect(screen.getByTestId('chat-input')).toBeDisabled();
});

test('approval flow: approve sends the exact approval payload', async () => {
  mockConfigAndChat(
    ENABLED_CONFIG,
    [APPROVAL_EVENT],
    [
      {
        type: 'tool.running',
        id: 'tc1',
        tool: 'delete_dashboard',
        arguments: {},
      },
      {
        type: 'tool.completed',
        id: 'tc1',
        tool: 'delete_dashboard',
        result: '{"deleted": true}',
        truncated: false,
      },
      { type: 'message.completed', id: 'm2', content: 'Deleted.' },
      { type: 'request.completed' },
    ],
  );
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'delete dashboard 42{Enter}');

  const approvalCard = await screen.findByTestId('approval-card');
  expect(approvalCard).toHaveTextContent('Approval required');
  expect(approvalCard).toHaveTextContent('destructive');
  expect(approvalCard).toHaveTextContent('"identifier": 42');
  expect(approvalCard).toHaveTextContent('This action may not be reversible.');
  // Input is blocked while a decision is pending.
  expect(screen.getByTestId('chat-input')).toBeDisabled();

  await userEvent.click(screen.getByTestId('approval-approve'));
  expect(await screen.findByText('Deleted.')).toBeInTheDocument();

  const approvalCall = fetchCalls.find(call =>
    call.url.endsWith('/tool_approval'),
  );
  const body = JSON.parse(String(approvalCall?.init?.body));
  expect(body.approval_id).toBe('appr-1');
  expect(body.decision).toBe('approve');
  expect(body.tool_call).toEqual({
    id: 'tc1',
    name: 'delete_dashboard',
    arguments: { request: { identifier: 42 } },
  });
});

test('approval flow: reject reports rejection and re-enables input', async () => {
  mockConfigAndChat(
    ENABLED_CONFIG,
    [APPROVAL_EVENT],
    [
      { type: 'tool.rejected', id: 'tc1', tool: 'delete_dashboard' },
      { type: 'message.completed', id: 'm2', content: 'Okay, not deleting.' },
      { type: 'request.completed' },
    ],
  );
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'delete dashboard 42{Enter}');

  await screen.findByTestId('approval-card');
  await userEvent.click(screen.getByTestId('approval-reject'));

  expect(await screen.findByText('Okay, not deleting.')).toBeInTheDocument();
  const body = lastBody();
  expect(body.decision).toBe('reject');
  const card = screen.getByTestId('tool-call-delete_dashboard');
  expect(card).toHaveTextContent('Rejected');
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeEnabled());
});

test('backend errors surface with a working retry', async () => {
  let failNext = true;
  mockFetch(url => {
    if (url.endsWith('/config')) {
      return jsonResponse({ result: ENABLED_CONFIG });
    }
    if (failNext) {
      failNext = false;
      return jsonResponse(
        { message: 'The AI model provider request failed. Please try again.' },
        422,
      );
    }
    return jsonResponse({
      result: {
        conversation_id: 'conv_x',
        events: [
          { type: 'message.completed', id: 'm1', content: 'Recovered!' },
          { type: 'request.completed' },
        ],
      },
    });
  });
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'hello{Enter}');

  const error = await screen.findByTestId('chat-error');
  expect(error).toHaveTextContent('provider request failed');

  await userEvent.click(screen.getByTestId('chat-retry'));
  expect(await screen.findByText('Recovered!')).toBeInTheDocument();
});

test('new conversation clears the transcript and storage', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Hello!' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Hello!');

  await userEvent.click(screen.getByTestId('chat-new-conversation'));
  expect(await screen.findByTestId('chat-welcome')).toBeInTheDocument();
  await waitFor(() =>
    expect(__testing.storage.remove).toHaveBeenCalledWith('conversation'),
  );
});

test('new conversation drops attached context but not the draft', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Hello!' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Hello!');

  // Everything a composer can be holding when the button is pressed.
  dropUrl(screen.getByTestId('chat-composer'), '/dashboard/5/');
  await screen.findByTestId('chat-reference');
  await userEvent.upload(
    screen.getByTestId('chat-attach-input'),
    new File(['a,b\n1,2\n'], 'numbers.csv', { type: 'text/csv' }),
  );
  await screen.findByTestId('chat-attachment');
  await userEvent.type(input, 'a message I have not sent yet');

  await userEvent.click(screen.getByTestId('chat-new-conversation'));

  // The file and the dropped dashboard were staged for a conversation that
  // no longer exists, so they go with it.
  await waitFor(() =>
    expect(screen.queryByTestId('chat-attachment')).toBeNull(),
  );
  expect(screen.queryByTestId('chat-reference')).toBeNull();
  // The draft is the user's own writing, and clearing a conversation is not
  // a reason to throw it away.
  expect(screen.getByTestId('chat-input')).toHaveValue(
    'a message I have not sent yet',
  );
});

test('mode toggle switches between floating and panel', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  render(<ChatPanel />);
  await screen.findByTestId('chat-welcome');
  expect(chat.getDisplayMode()).toBe('floating');
  await userEvent.click(screen.getByTestId('chat-mode-toggle'));
  expect(chat.getDisplayMode()).toBe('panel');
  await userEvent.click(screen.getByTestId('chat-mode-toggle'));
  expect(chat.getDisplayMode()).toBe('floating');
});

test('close button closes through the public API', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  chat.open();
  render(<ChatPanel />);
  await screen.findByTestId('chat-welcome');
  await userEvent.click(screen.getByTestId('chat-close'));
  expect(chat.isOpen()).toBe(false);
});

test('page navigation adds a context note without discarding messages', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Hello!' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Hello!');

  // Each navigation changes the URL and the page together, as the host does.
  window.history.pushState({}, '', '/dashboard/world_health/?a=1');
  act(() => {
    __testing.setPage('dashboard');
  });
  await screen.findByText(/You navigated to Dashboard/);

  window.history.pushState({}, '', '/sqllab');
  act(() => {
    __testing.setPage('sqllab');
  });
  expect(
    await screen.findByText(/You navigated to SQL Lab/),
  ).toBeInTheDocument();
  // Previous messages are retained.
  expect(screen.getByText('Hello!')).toBeInTheDocument();

  // Nothing was said between the two navigations, so there is one note, and
  // it still links back to where the conversation happened.
  expect(screen.queryByText(/You navigated to Dashboard\./)).toBeNull();
  const backLinks = screen.getAllByTestId('note-back-link');
  expect(backLinks).toHaveLength(1);
  expect(backLinks[0]).toHaveTextContent('Back to Home');
  expect(backLinks[0]).toHaveAttribute('href', '/');
});

test('unmount disposes navigation and display-mode subscriptions', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  const beforeCounts = {
    page: __testing.pageListenerCount(),
    mode: __testing.modeListenerCount(),
  };
  const { unmount } = render(<ChatPanel />);
  await screen.findByTestId('chat-welcome');
  expect(__testing.pageListenerCount()).toBeGreaterThan(beforeCounts.page);
  unmount();
  expect(__testing.pageListenerCount()).toBe(beforeCounts.page);
  expect(__testing.modeListenerCount()).toBe(beforeCounts.mode);
});

test('an attached file is sent with the message and named in the transcript', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Two columns.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  await userEvent.upload(
    screen.getByTestId('chat-attach-input'),
    new File(['a,b\n1,2'], 'rows.csv', { type: 'text/csv' }),
  );
  expect(await screen.findByTestId('chat-attachment')).toHaveTextContent(
    'rows.csv',
  );

  await userEvent.type(input, 'what is in this file?{Enter}');
  await screen.findByText('Two columns.');

  // The model gets the file contents inside a delimited block...
  const sent = (lastBody().messages as { content: string }[]).at(-1)!.content;
  expect(sent).toContain('what is in this file?');
  expect(sent).toContain('<ATTACHED-FILE name="rows.csv">\na,b\n1,2');

  // ...while the transcript shows the question and the file name only.
  const bubble = screen.getByTestId('chat-message-user');
  expect(bubble).toHaveTextContent('what is in this file?');
  expect(bubble).toHaveTextContent('rows.csv');
  expect(bubble).not.toHaveTextContent('a,b');

  // Staged files are cleared once sent.
  expect(screen.queryByTestId('chat-attachment')).toBeNull();
});

test('a screenshot is previewed in the chat and sent as an image part', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'A bar chart.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  await userEvent.upload(
    screen.getByTestId('chat-attach-input'),
    new File(['fake-png-bytes'], 'screenshot.png', { type: 'image/png' }),
  );
  // Staged in the composer as a thumbnail, not as a file name.
  const staged = await screen.findByTestId('chat-attachment');
  expect(staged.querySelector('img')).toHaveAttribute(
    'src',
    expect.stringContaining('data:image'),
  );

  // Clicking it opens the full-size preview, before anything is sent.
  await userEvent.click(staged.querySelector('img')!);
  const lightbox = await screen.findByRole('dialog');
  expect(lightbox.querySelector('img')).toHaveAttribute(
    'src',
    expect.stringContaining('data:image'),
  );
  await userEvent.keyboard('{Escape}');
  expect(fetchCalls.filter(call => call.url.endsWith('/chat'))).toHaveLength(0);

  await userEvent.type(input, 'what does this show?{Enter}');
  await screen.findByText('A bar chart.');

  const sent = (lastBody().messages as Record<string, unknown>[]).at(-1)!;
  expect(sent.content).toBe('what does this show?');
  expect(sent.images).toEqual([
    {
      media_type: 'image/png',
      data: expect.any(String),
      name: 'screenshot.png',
    },
  ]);

  // The transcript previews it inside the message bubble. antd's Image wraps
  // the element it renders, so the thumbnail itself is queried underneath.
  const preview = screen
    .getByTestId('chat-message-attachment')
    .querySelector('img');
  expect(preview).toHaveAttribute('src', expect.stringContaining('data:image'));
  expect(preview).toHaveAttribute('alt', 'screenshot.png');
});

function dropUrl(target: HTMLElement, url: string) {
  const dataTransfer = {
    files: [],
    getData: (type: string) => (type === 'text/uri-list' ? url : ''),
  };
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

test('dragging a chart in pins it as context for every later message', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Sure.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  // The href a dashboard renders on a chart header.
  dropUrl(
    screen.getByTestId('chat-composer'),
    '/explore/?dashboard_page_id=abc&slice_id=100',
  );
  expect(await screen.findByTestId('chat-reference')).toHaveTextContent(
    'Chart 100',
  );

  await userEvent.type(input, 'compare these{Enter}');
  await screen.findByText('Sure.');
  expect((lastBody().context as Record<string, unknown>).references).toEqual([
    { kind: 'chart', id_or_slug: '100' },
  ]);

  // The question records what it was asked about, linked to the chart.
  const tag = screen.getByTestId('chat-message-reference');
  expect(tag).toHaveTextContent('Chart 100');
  expect(tag.closest('a')).toHaveAttribute('href', '/explore/?slice_id=100');

  // Still attached for the next question: that is the point of dropping it.
  await userEvent.type(input, 'and now?{Enter}');
  await waitFor(() =>
    expect((lastBody().context as Record<string, unknown>).references).toEqual([
      { kind: 'chart', id_or_slug: '100' },
    ]),
  );
  expect(screen.getByTestId('chat-reference')).toBeInTheDocument();
});

test('a dropped object can be removed, and duplicates are ignored', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  render(<ChatPanel />);
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeEnabled());
  const composer = screen.getByTestId('chat-composer');

  dropUrl(composer, '/superset/dashboard/world_health/');
  dropUrl(composer, '/superset/dashboard/world_health/');
  expect(await screen.findAllByTestId('chat-reference')).toHaveLength(1);

  dropUrl(composer, '/dashboard/5/');
  expect(await screen.findAllByTestId('chat-reference')).toHaveLength(2);

  await userEvent.click(screen.getAllByLabelText('Close')[0]);
  await waitFor(() =>
    expect(screen.getAllByTestId('chat-reference')).toHaveLength(1),
  );
});

test('a question keeps the context it was asked with once detached', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Sure.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  dropUrl(
    screen.getByTestId('chat-composer'),
    '/superset/dashboard/world_health/',
  );
  await screen.findByTestId('chat-reference');
  await userEvent.type(input, 'what is in here?{Enter}');
  await screen.findByText('Sure.');

  // Detaching stops it riding along with later turns. The transcript still
  // shows what this one carried, since that is what the model was asked.
  await userEvent.click(screen.getByLabelText('Close'));
  await waitFor(() =>
    expect(screen.queryByTestId('chat-reference')).toBeNull(),
  );
  const tag = screen.getByTestId('chat-message-reference');
  expect(tag).toHaveTextContent('Dashboard world_health');
  expect(tag.closest('a')).toHaveAttribute('href', '/dashboard/world_health/');
});

test('dropping something that is not a Superset object explains itself', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  render(<ChatPanel />);
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeEnabled());

  dropUrl(screen.getByTestId('chat-composer'), 'https://example.com/thing');
  expect(await screen.findByTestId('chat-reference-error')).toHaveTextContent(
    'Drop a Superset dashboard, chart or dataset',
  );
  expect(screen.queryByTestId('chat-reference')).toBeNull();
});

test('two quick picks cannot stage more than the attachment limit', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  render(<ChatPanel />);
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeEnabled());

  const picker = screen.getByTestId('chat-attach-input');
  const file = (name: string) =>
    new File([`${name} rows`], name, { type: 'text/csv' });
  // Both picks are made before either batch has landed in state.
  await Promise.all([
    userEvent.upload(picker, [file('a.csv'), file('b.csv')]),
    userEvent.upload(picker, [file('c.csv'), file('d.csv')]),
  ]);

  await waitFor(() =>
    expect(screen.getAllByTestId('chat-attachment').length).toBeGreaterThan(0),
  );
  expect(screen.getAllByTestId('chat-attachment').length).toBeLessThanOrEqual(
    3,
  );
});

test('a file that cannot be read is refused without staging it', async () => {
  mockConfigAndChat(ENABLED_CONFIG, []);
  render(<ChatPanel />);
  await waitFor(() => expect(screen.getByTestId('chat-input')).toBeEnabled());

  // `accept` is only a hint to the file dialog — a user can still pick
  // something else — so the runtime check is what this exercises.
  await userEvent.upload(
    screen.getByTestId('chat-attach-input'),
    new File(['...'], 'report.pdf', { type: 'application/pdf' }),
    { applyAccept: false },
  );

  expect(await screen.findByTestId('chat-attachment-error')).toHaveTextContent(
    'report.pdf cannot be attached',
  );
  expect(screen.queryByTestId('chat-attachment')).toBeNull();
  expect(screen.getByTestId('chat-send')).toBeDisabled();
});

test('the fold-all button folds the transcript, then offers to reopen it', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    {
      type: 'message.completed',
      id: 'm1',
      content: '## Revenue overview\n\nRevenue grew in every region.',
    },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Revenue overview');

  const button = () => screen.getByTestId('chat-collapse-all');
  // antd keeps folded content mounted, so the state is read semantically.
  const reply = () =>
    screen
      .getByTestId('chat-message-assistant')
      .querySelector('[aria-expanded]');

  expect(button()).toHaveAttribute('aria-label', 'Collapse all');
  expect(reply()).toHaveAttribute('aria-expanded', 'true');

  await userEvent.click(button());
  await waitFor(() =>
    expect(reply()).toHaveAttribute('aria-expanded', 'false'),
  );
  expect(button()).toHaveAttribute('aria-label', 'Expand all');

  await userEvent.click(button());
  await waitFor(() => expect(reply()).toHaveAttribute('aria-expanded', 'true'));
  expect(button()).toHaveAttribute('aria-label', 'Collapse all');
});

test('clear is disabled until the transcript has something to discard', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Hello!' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  expect(screen.getByTestId('chat-new-conversation')).toBeDisabled();

  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Hello!');

  await waitFor(() =>
    expect(screen.getByTestId('chat-new-conversation')).toBeEnabled(),
  );

  await userEvent.click(screen.getByTestId('chat-new-conversation'));
  await waitFor(() =>
    expect(screen.getByTestId('chat-new-conversation')).toBeDisabled(),
  );
});

test('collapse-all stays disabled when nothing on screen can fold', async () => {
  // A one-line reply is fully shown by its own title, so AssistantMessage
  // renders it flat and the header has no panel to act on.
  mockConfigAndChat(ENABLED_CONFIG, [
    { type: 'message.completed', id: 'm1', content: 'Hello!' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  expect(screen.getByTestId('chat-collapse-all')).toBeDisabled();

  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Hello!');

  expect(screen.getByTestId('chat-collapse-all')).toBeDisabled();
});

test('collapse-all enables once a reply is long enough to fold', async () => {
  mockConfigAndChat(ENABLED_CONFIG, [
    {
      type: 'message.completed',
      id: 'm1',
      content: '## Revenue overview\n\nRevenue grew in every region.',
    },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());

  expect(screen.getByTestId('chat-collapse-all')).toBeDisabled();

  await userEvent.type(input, 'hi{Enter}');
  await screen.findByText('Revenue overview');

  await waitFor(() =>
    expect(screen.getByTestId('chat-collapse-all')).toBeEnabled(),
  );

  // Clearing empties the transcript, so it returns to disabled.
  await userEvent.click(screen.getByTestId('chat-new-conversation'));
  await waitFor(() =>
    expect(screen.getByTestId('chat-collapse-all')).toBeDisabled(),
  );
});

test('collapse-all closes a tool card, then stops offering to reopen it', async () => {
  mockConfigAndChat(SUPERVISED_CONFIG, [
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
      result: '{"count": 2}',
      truncated: false,
    },
    { type: 'message.completed', id: 'm1', content: 'Two.' },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'list dashboards{Enter}');
  await screen.findByTestId('tool-call-list_dashboards');

  // The card is a panel, so it alone is enough to collapse.
  const button = () => screen.getByTestId('chat-collapse-all');
  await waitFor(() => expect(button()).toBeEnabled());
  await userEvent.click(button());

  // Expand-all reopens replies only, and 'Two.' is short enough to render
  // flat, so the other direction has nothing to act on.
  await waitFor(() =>
    expect(button()).toHaveAttribute('aria-label', 'Expand all'),
  );
  expect(button()).toBeDisabled();
});

test('expand-all reopens the reply and leaves tool cards closed', async () => {
  mockConfigAndChat(SUPERVISED_CONFIG, [
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
      result: '{"count": 2}',
      truncated: false,
    },
    {
      type: 'message.completed',
      id: 'm1',
      content: '## Revenue overview\n\nRevenue grew in every region.',
    },
    { type: 'request.completed' },
  ]);
  render(<ChatPanel />);
  const input = await screen.findByTestId('chat-input');
  await waitFor(() => expect(input).toBeEnabled());
  await userEvent.type(input, 'list dashboards{Enter}');
  await screen.findByText('Revenue overview');

  // antd keeps folded content mounted, so the state is read semantically.
  const reply = () =>
    screen
      .getByTestId('chat-message-assistant')
      .querySelector('[aria-expanded]');
  const cardBox = () => screen.getByTestId('tool-call-list_dashboards');
  const card = () => cardBox().querySelector('[aria-expanded]');
  const button = () => screen.getByTestId('chat-collapse-all');

  // Open the card by hand: only then can expand-all be seen leaving it alone.
  // Scoped to the card, since the typed question repeats the tool's name.
  await userEvent.click(within(cardBox()).getByText('list dashboards'));
  await waitFor(() => expect(card()).toHaveAttribute('aria-expanded', 'true'));

  await userEvent.click(button());
  await waitFor(() =>
    expect(reply()).toHaveAttribute('aria-expanded', 'false'),
  );
  expect(card()).toHaveAttribute('aria-expanded', 'false');

  await userEvent.click(button());
  await waitFor(() => expect(reply()).toHaveAttribute('aria-expanded', 'true'));
  // The point of the test: raw tool output does not come back with the answer.
  expect(card()).toHaveAttribute('aria-expanded', 'false');
});
