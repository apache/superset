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
 * Conversation state, transcript reconciliation and request context.
 */

import { renderHook } from '@testing-library/react';
import { act, createWrapper, waitFor } from 'spec/helpers/testing-library';
import {
  AGENT_STORAGE_KEY,
  buildRequestPageContext,
  mergeMessages,
  useChatBot,
} from './useChatBot';
import * as chatRequest from './chatRequest';
import * as chatThreadsApi from './chatThreadsApi';
import type { AiThread, ChatMessageWithMeta } from '../types';
import type { PageContext } from './usePageContext';

const message = (
  overrides: Partial<ChatMessageWithMeta>,
): ChatMessageWithMeta => ({
  id: 'id',
  role: 'assistant',
  content: 'content',
  timestamp: 0,
  ...overrides,
});

const pageContext: PageContext = {
  url: '/sqllab',
  pathname: '/sqllab',
  pageType: 'sqllab',
};

afterEach(() => {
  jest.restoreAllMocks();
  localStorage.clear();
});

const mockConversations = (threads: AiThread[]) => {
  jest.spyOn(chatThreadsApi, 'listThreads').mockResolvedValue(threads);
  jest.spyOn(chatThreadsApi, 'getThread').mockImplementation(async uuid => ({
    thread: threads.find(thread => thread.uuid === uuid)!,
    messages: [],
  }));
  jest.spyOn(chatThreadsApi, 'updateThread').mockResolvedValue(undefined);
  jest.spyOn(chatRequest, 'fetchAgents').mockResolvedValue([
    { key: 'default', name: 'Assistant', tools: [] },
    { key: 'analyst', name: 'Analyst', tools: [] },
  ]);
};

test.each([
  ['analyst', 'default'],
  ['default', 'analyst'],
  [undefined, 'analyst'],
])(
  'restores conversation profile %s, not browser preference %s',
  async (stored, preferred) => {
    localStorage.setItem(AGENT_STORAGE_KEY, preferred!);
    const threads = [
      { uuid: 'thread-1', agentKey: stored },
      { uuid: 'thread-2', agentKey: 'analyst' },
    ];
    mockConversations(threads);
    const { result, unmount } = renderHook(useChatBot, {
      wrapper: createWrapper({ useRedux: true, useRouter: true }),
    });
    await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
    expect(result.current.selectedAgent).toBe(stored ?? 'default');
    await act(() => result.current.handleSelectTab('thread-2'));
    expect(result.current.selectedAgent).toBe('analyst');
    act(() => result.current.setSelectedAgent('default'));
    await act(() => result.current.handleSelectTab('thread-1'));
    expect(result.current.selectedAgent).toBe(stored ?? 'default');
    await act(() => result.current.handleSelectTab('thread-2'));
    expect(result.current.selectedAgent).toBe('default');
    unmount();

    // An unsent choice is not a persisted change to the conversation.
    const reopened = renderHook(useChatBot, {
      wrapper: createWrapper({ useRedux: true, useRouter: true }),
    });
    await waitFor(() =>
      expect(reopened.result.current.threadsLoaded).toBe(true),
    );
    expect(reopened.result.current.activeTabId).toBe('thread-2');
    expect(reopened.result.current.selectedAgent).toBe('analyst');
  },
);

test.each(['default', 'analyst'])(
  'a completed run preserves tab choices and restores resolved profile %s',
  async resolved => {
    const threads = [
      { uuid: 'thread-1', agentKey: 'analyst' },
      { uuid: 'thread-2', agentKey: 'default' },
    ];
    mockConversations(threads);
    const started = jest.spyOn(chatRequest, 'startRun').mockResolvedValue({
      threadUuid: 'thread-1',
      messageUuid: 'user-1',
      assistantMessageUuid: 'assistant-1',
      runId: 'run-1',
    });
    let release!: (value: { content: string; cancelled: boolean }) => void;
    jest.spyOn(chatRequest, 'streamRun').mockReturnValue(
      new Promise(resolve => {
        release = resolve;
      }),
    );
    const { result } = renderHook(useChatBot, {
      wrapper: createWrapper({ useRedux: true, useRouter: true }),
    });
    await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
    let running!: Promise<void>;
    act(() => {
      running = result.current.sendMessage('first question');
    });
    await waitFor(() => expect(started).toHaveBeenCalled());
    // An unchanged selection lets the server use its authoritative profile.
    expect(started.mock.calls[0][0].agentKey).toBeUndefined();
    act(() => result.current.setSelectedAgent('default'));
    await act(() => result.current.handleSelectTab('thread-2'));
    act(() => result.current.setSelectedAgent('analyst'));
    await act(async () => {
      release({ content: 'answer', cancelled: false });
      await running;
    });
    expect(result.current.selectedAgent).toBe('analyst');
    await act(() => result.current.handleSelectTab('thread-1'));
    expect(result.current.selectedAgent).toBe('default');

    // The next accepted turn stores the choice; the refreshed server copy wins.
    started.mockImplementationOnce(async options => {
      expect(options.agentKey).toBe('default');
      threads[0].agentKey = resolved;
      return { threadUuid: 'thread-1', messageUuid: 'user-2', runId: 'run-2' };
    });
    await act(() => result.current.sendMessage('next question'));
    expect(result.current.selectedAgent).toBe(resolved);
    expect(result.current.activeTab?.pendingAgentKey).toBeUndefined();
  },
);

test('new conversations use the preference or the active selection', async () => {
  localStorage.setItem(AGENT_STORAGE_KEY, 'analyst');
  mockConversations([]);
  const created = jest.spyOn(chatThreadsApi, 'createThread').mockResolvedValue({
    uuid: 'first',
    agentKey: 'analyst',
  });
  const { result } = renderHook(useChatBot, {
    wrapper: createWrapper({ useRedux: true, useRouter: true }),
  });
  await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
  expect(created).toHaveBeenCalledWith(undefined, 'analyst');
  expect(result.current.selectedAgent).toBe('analyst');
  act(() => result.current.setSelectedAgent('default'));
  created.mockResolvedValueOnce({ uuid: 'second', agentKey: 'default' });
  await act(() => result.current.handleNewChat());
  expect(created).toHaveBeenLastCalledWith(undefined, 'default');
  expect(result.current.selectedAgent).toBe('default');
});

test('the server transcript replaces the local one turn for turn', () => {
  const merged = mergeMessages(
    [
      message({ id: 'server-user', role: 'user', content: 'ask' }),
      message({ id: 'server-reply', content: 'answer' }),
    ],
    [
      message({ id: 'local-1', role: 'user', content: 'ask', pending: true }),
      message({ id: 'local-1-reply', content: 'answer', pending: true }),
    ],
  );

  // The same two turns, now under their real uuids and with no duplicates.
  expect(merged.map(entry => entry.id)).toEqual([
    'server-user',
    'server-reply',
  ]);
});

test('a turn the server has not recorded yet is kept', () => {
  const merged = mergeMessages(
    [message({ id: 'server-user', role: 'user', content: 'ask' })],
    [
      message({ id: 'local-1', role: 'user', content: 'ask' }),
      message({ id: 'local-1-reply', content: 'the answer just shown' }),
    ],
  );

  // Dropping it would erase an answer the user has already read.
  expect(merged.map(entry => entry.content)).toEqual([
    'ask',
    'the answer just shown',
  ]);
});

test('an empty server transcript does not wipe what is on screen', () => {
  const local = [message({ id: 'local-1', role: 'user', content: 'ask' })];

  expect(mergeMessages([], local)).toEqual(local);
});

test('page context is omitted entirely when the user turns it off', () => {
  expect(buildRequestPageContext(undefined)).toBeUndefined();
});

test('a directive alone still travels, since there is no system-message field', () => {
  expect(buildRequestPageContext(undefined, 'Be terse')).toEqual({
    helper_directives: ['Be terse'],
  });
});

test('a directive is prepended to the page own directives', () => {
  const payload = buildRequestPageContext(
    {
      ...pageContext,
      pageMarkdown: [
        { source: 'chart_description', content: '@helper Weekly' },
      ],
    },
    'Be terse',
  );

  // The caller's directive comes first so it takes precedence when they conflict.
  expect(payload?.helper_directives).toEqual(['Be terse', 'Weekly']);
  expect(payload?.pageType).toBe('sqllab');
});
