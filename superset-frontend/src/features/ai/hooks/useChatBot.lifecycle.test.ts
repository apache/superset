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

import { act, renderHook, waitFor } from '@testing-library/react';
import {
  cancelChatRun,
  fetchAgents,
  startRun,
  streamRun,
  type RunHandle,
} from './chatRequest';
import { getThread, listThreads, updateThread } from './chatThreadsApi';
import { useChatBot } from './useChatBot';
import { usePageContext } from './usePageContext';
import { isDefined, parseMessage } from '../types';

jest.mock('./chatRequest', () => ({
  ...jest.requireActual('./chatRequest'),
  cancelChatRun: jest.fn(),
  fetchAgents: jest.fn(),
  startRun: jest.fn(),
  streamRun: jest.fn(),
}));

jest.mock('./chatThreadsApi', () => ({
  ...jest.requireActual('./chatThreadsApi'),
  getThread: jest.fn(),
  listThreads: jest.fn(),
  updateThread: jest.fn(),
}));

jest.mock('./usePageContext', () => ({
  ...jest.requireActual('./usePageContext'),
  usePageContext: jest.fn(),
}));

const handle = (threadUuid: string): RunHandle => ({
  threadUuid,
  messageUuid: `message-${threadUuid}`,
  runId: `run-${threadUuid}`,
});

beforeEach(() => {
  localStorage.clear();
  jest.clearAllMocks();
  jest.mocked(usePageContext).mockReturnValue({
    url: '/',
    pathname: '/',
    pageType: 'other',
  });
  jest.mocked(listThreads).mockResolvedValue([
    { uuid: 'first', title: 'First' },
    { uuid: 'second', title: 'Second' },
  ]);
  jest.mocked(getThread).mockImplementation(async uuid => ({
    thread: { uuid },
    messages: [],
  }));
  jest.mocked(updateThread).mockResolvedValue();
  jest.mocked(fetchAgents).mockResolvedValue([]);
  jest.mocked(cancelChatRun).mockResolvedValue();
  jest
    .mocked(startRun)
    .mockImplementation(async ({ threadUuid }) => handle(threadUuid));
});

afterEach(() => {
  jest.useRealTimers();
});

const savedReply = (status: string, content = '') => ({
  thread: { uuid: 'first' },
  messages: [
    parseMessage({
      uuid: 'saved-reply',
      role: 'assistant',
      content,
      status,
      extra: { run_id: 'accepted-run' },
    }),
  ].filter(isDefined),
});

test.each(['complete', 'error', 'cancelled'])(
  'a restored run refreshes until %s without starting another run',
  async status => {
    jest.useFakeTimers();
    jest
      .mocked(getThread)
      .mockResolvedValueOnce(savedReply('streaming'))
      .mockResolvedValue(savedReply(status, 'saved result'));
    const { result } = renderHook(useChatBot);
    await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
    expect(result.current.isLoading).toBe(true);
    await act(async () => {
      await result.current.sendMessage('do not overlap the restored run');
      jest.advanceTimersByTime(2000);
    });

    await waitFor(() =>
      expect(result.current.messages[0].content).toBe('saved result'),
    );
    expect(result.current.isLoading).toBe(false);
    expect(result.current.messages[0]).toMatchObject({
      status,
      runId: 'accepted-run',
    });
    act(() => jest.advanceTimersByTime(10_000));
    expect(getThread).toHaveBeenCalledTimes(2);
    expect(startRun).not.toHaveBeenCalled();
    expect(streamRun).not.toHaveBeenCalled();
  },
);

test('unmounting stops polling a restored run', async () => {
  jest.useFakeTimers();
  jest.mocked(getThread).mockResolvedValue(savedReply('pending'));
  const { result, unmount } = renderHook(useChatBot);
  await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
  expect(result.current.isLoading).toBe(true);

  unmount();
  act(() => jest.advanceTimersByTime(10_000));
  expect(getThread).toHaveBeenCalledTimes(1);
});

test('Stop targets the saved run after reloading a conversation', async () => {
  jest.mocked(getThread).mockResolvedValue(savedReply('streaming'));
  const { result } = renderHook(useChatBot);
  await waitFor(() => expect(result.current.threadsLoaded).toBe(true));

  await act(async () => result.current.handleCancelRun());
  expect(cancelChatRun).toHaveBeenCalledWith('first', 'accepted-run');
  expect(startRun).not.toHaveBeenCalled();
});

test('an in-flight refresh cannot restart polling after unmount', async () => {
  jest.useFakeTimers();
  let finish: ((value: ReturnType<typeof savedReply>) => void) | undefined;
  jest
    .mocked(getThread)
    .mockResolvedValueOnce(savedReply('streaming'))
    .mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        }),
    );
  const { result, unmount } = renderHook(useChatBot);
  await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
  act(() => jest.advanceTimersByTime(2000));
  expect(getThread).toHaveBeenCalledTimes(2);

  unmount();
  await act(async () => finish?.(savedReply('streaming')));
  act(() => jest.advanceTimersByTime(10_000));
  expect(getThread).toHaveBeenCalledTimes(2);
});

test.each(['continue', 'cancel'])(
  '%s releases only the selected conversation checkpoint',
  async action => {
    const resumed: string[] = [];
    jest
      .mocked(streamRun)
      .mockImplementation(async ({ threadUuid, onCheckpoint }) => {
        await onCheckpoint?.({
          summary: threadUuid,
          requiresConfirmation: true,
        });
        resumed.push(threadUuid);
        return { content: `answer-${threadUuid}`, cancelled: false };
      });
    const { result } = renderHook(useChatBot);
    await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
    let first: Promise<void> | undefined;
    act(() => {
      first = result.current.sendMessage('first question');
    });
    await waitFor(() =>
      expect(result.current.checkpoint?.summary).toBe('first'),
    );
    await act(() => result.current.handleSelectTab('second'));
    let second: Promise<void> | undefined;
    act(() => {
      second = result.current.sendMessage('second question');
    });
    await waitFor(() =>
      expect(result.current.checkpoint?.summary).toBe('second'),
    );
    await act(() => result.current.handleSelectTab('first'));
    await act(async () => {
      if (action === 'continue') result.current.handleCheckpointContinue();
      else await result.current.handleCancelRun();
    });
    expect(resumed).toEqual(['first']);
    await act(() => result.current.handleSelectTab('second'));
    expect(result.current.checkpoint?.summary).toBe('second');
    await act(async () => {
      result.current.handleCheckpointContinue();
      await Promise.all([first, second]);
    });
    expect(resumed).toEqual(['first', 'second']);
  },
);

test.each(['stop', 'unmount'])(
  '%s before the start response cancels the accepted run',
  async action => {
    let finishStart: ((run: RunHandle) => void) | undefined;
    jest.mocked(startRun).mockImplementation(
      () =>
        new Promise(resolve => {
          finishStart = resolve;
        }),
    );
    jest.mocked(streamRun).mockResolvedValue({ content: '', cancelled: false });
    const { result, unmount } = renderHook(useChatBot);
    await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
    let sending: Promise<void> | undefined;
    act(() => {
      sending = result.current.sendMessage('question');
    });
    await waitFor(() => expect(startRun).toHaveBeenCalledTimes(1));
    if (action === 'unmount') {
      unmount();
    } else {
      await act(() => result.current.handleCancelRun());
      expect(result.current.activeRunStatus).toBe('cancelling');
      await act(() => result.current.sendMessage('overlapping question'));
    }
    expect(cancelChatRun).not.toHaveBeenCalled();
    expect(startRun).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishStart?.(handle('first'));
      await sending;
    });
    expect(cancelChatRun).toHaveBeenCalledTimes(1);
    expect(cancelChatRun).toHaveBeenCalledWith('first', 'run-first');
    expect(streamRun).not.toHaveBeenCalled();
    if (action === 'stop') {
      expect(result.current.isLoading).toBe(false);
    }
  },
);

test('unmount releases every checkpoint and cancels each owned server run', async () => {
  const resumed: string[] = [];
  const signals: AbortSignal[] = [];
  jest
    .mocked(streamRun)
    .mockImplementation(async ({ threadUuid, signal, onCheckpoint }) => {
      if (signal) signals.push(signal);
      await onCheckpoint?.({ summary: threadUuid, requiresConfirmation: true });
      resumed.push(threadUuid);
      return { content: '', cancelled: true };
    });
  const { result, unmount } = renderHook(useChatBot);
  await waitFor(() => expect(result.current.threadsLoaded).toBe(true));
  let first!: Promise<void>;
  let second!: Promise<void>;
  act(() => {
    first = result.current.sendMessage('first');
  });
  await waitFor(() => expect(result.current.checkpoint).not.toBeNull());
  await act(() => result.current.handleSelectTab('second'));
  act(() => {
    second = result.current.sendMessage('second');
  });
  await waitFor(() =>
    expect(result.current.checkpoint?.summary).toBe('second'),
  );
  unmount();
  expect(signals.every(signal => signal.aborted)).toBe(true);
  expect(cancelChatRun).toHaveBeenCalledWith('first', 'run-first');
  expect(cancelChatRun).toHaveBeenCalledWith('second', 'run-second');
  await Promise.all([first, second]);
  expect(resumed.sort()).toEqual(['first', 'second']);
});
