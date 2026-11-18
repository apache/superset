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
import { act, renderHook } from '@testing-library/react';
import useOAuth2Completion from './useOAuth2Completion';

let channel: {
  onmessage: ((event: { data: unknown }) => void) | null;
  close: jest.Mock;
};
const originalBroadcastChannel = global.BroadcastChannel;

beforeEach(() => {
  global.BroadcastChannel = jest.fn().mockImplementation(() => {
    channel = { onmessage: null, close: jest.fn() };
    return channel;
  });
});

afterEach(() => {
  global.BroadcastChannel = originalBroadcastChannel;
});

function notify(transport: string, tabId = 'attempt') {
  act(() => {
    if (transport === 'broadcast') {
      channel.onmessage?.({ data: { tabId } });
    } else {
      window.dispatchEvent(
        new StorageEvent('storage', {
          key: 'oauth2_auth_complete',
          newValue: JSON.stringify({ tabId }),
        }),
      );
    }
  });
}

test.each(['broadcast', 'storage'])(
  'retries a deferred %s completion after query state loads, once across transports',
  transport => {
    const onComplete = jest.fn().mockReturnValue(false);
    const { rerender } = renderHook(() =>
      useOAuth2Completion('attempt', onComplete),
    );

    notify(transport);
    expect(onComplete).toHaveBeenCalledTimes(1);

    const onQueryLoaded = jest.fn();
    rerender();
    expect(onComplete).toHaveBeenCalledTimes(2);
    onComplete.mockImplementation(onQueryLoaded);
    rerender();
    expect(onQueryLoaded).toHaveBeenCalledTimes(1);

    notify('broadcast');
    notify('storage');
    rerender();
    expect(onQueryLoaded).toHaveBeenCalledTimes(1);
  },
);

test('uses the latest callback when retrying a deferred completion', () => {
  const deferred = jest.fn().mockReturnValue(false);
  const ready = jest.fn();
  const { rerender } = renderHook(
    ({ onComplete }) => useOAuth2Completion('attempt', onComplete),
    { initialProps: { onComplete: deferred } },
  );
  notify('broadcast');
  rerender({ onComplete: ready });
  expect(deferred).toHaveBeenCalledTimes(1);
  expect(ready).toHaveBeenCalledTimes(1);
});

test('discards pending completions when the connection attempt changes', () => {
  const onComplete = jest.fn().mockReturnValue(false);
  const { rerender, unmount } = renderHook(
    ({ tabId }: { tabId: string | undefined }) =>
      useOAuth2Completion(tabId, onComplete),
    { initialProps: { tabId: 'attempt' } },
  );
  notify('storage');
  const previousChannel = channel;
  onComplete.mockReturnValue(true);
  rerender({ tabId: 'next-attempt' });
  expect(previousChannel.close).toHaveBeenCalledTimes(1);
  notify('broadcast');
  expect(onComplete).toHaveBeenCalledTimes(1);

  notify('storage', 'next-attempt');
  expect(onComplete).toHaveBeenCalledTimes(2);
  rerender({ tabId: undefined });
  expect(channel.close).toHaveBeenCalledTimes(1);
  notify('storage', 'next-attempt');
  unmount();
  expect(onComplete).toHaveBeenCalledTimes(2);
});

test('does not retry a deferred completion after unmount', () => {
  const onComplete = jest.fn().mockReturnValue(false);
  const { unmount } = renderHook(() =>
    useOAuth2Completion('attempt', onComplete),
  );
  notify('broadcast');
  unmount();
  expect(channel.close).toHaveBeenCalledTimes(1);
  notify('storage');
  expect(onComplete).toHaveBeenCalledTimes(1);
});
