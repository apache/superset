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

import fetchMock from 'fetch-mock';
import { FeatureFlag } from '@superset-ui/core';
import { act, render, screen } from 'spec/helpers/testing-library';
import { chat } from 'src/core/chat';
import ChatProvider from 'src/core/chat/ChatProvider';
import { ChatFloatingHost } from 'src/core/chat/ChatHost';
import {
  AI_CHAT_ID,
  registerAiAssistant,
  unregisterAiAssistant,
} from './index';

// AI_ASSISTANT is a backend flag the frontend enum does not carry.
const AI_ASSISTANT_FLAG = 'AI_ASSISTANT' as FeatureFlag;

const enableFlag = (enabled: boolean) => {
  window.featureFlags = {
    ...window.featureFlags,
    [AI_ASSISTANT_FLAG]: enabled,
  };
};

beforeEach(() => {
  // The panel loads agents and conversations as soon as it mounts, and creates
  // one when the user has none.
  fetchMock.get('glob:*/api/v1/ai/agent/*', { result: [] });
  fetchMock.get('glob:*/api/v1/ai/thread/*', { count: 0, result: [] });
  fetchMock.post('glob:*/api/v1/ai/thread/', {
    result: { uuid: 'thread-uuid-1', title: 'New Chat', status: 'active' },
  });
  unregisterAiAssistant();
  ChatProvider.getInstance().reset();
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  unregisterAiAssistant();
  fetchMock.clearHistory().removeRoutes();
  enableFlag(false);
});

test('does not register the assistant while the feature flag is off', () => {
  enableFlag(false);

  expect(registerAiAssistant()).toBeUndefined();
  expect(chat.getChat()).toBeUndefined();
});

test('registers a chat provider when the feature flag is on', () => {
  enableFlag(true);

  registerAiAssistant();

  expect(chat.getChat()).toEqual(
    expect.objectContaining({ id: AI_CHAT_ID, name: 'AI assistant' }),
  );
});

test('registering twice reuses the single registration', () => {
  enableFlag(true);

  const first = registerAiAssistant();
  const second = registerAiAssistant();

  // A second call must not displace the provider, which the host would warn
  // about and which would close an open panel.
  expect(second).toBe(first);
});

test('disposing the registration removes the provider', () => {
  enableFlag(true);
  registerAiAssistant();

  unregisterAiAssistant();

  expect(chat.getChat()).toBeUndefined();
});

test('the host mounts the trigger, and the panel once the chat opens', async () => {
  enableFlag(true);
  registerAiAssistant();

  // The panel reads the route (for page context) and dispatches SQL Lab actions,
  // so it needs both a router and a store.
  render(<ChatFloatingHost />, { useRedux: true, useRouter: true });

  expect(await screen.findByTestId('ai-assistant-trigger')).toBeInTheDocument();
  expect(screen.queryByTestId('ai-assistant-panel')).not.toBeInTheDocument();

  act(() => chat.open());

  expect(await screen.findByTestId('ai-assistant-panel')).toBeInTheDocument();
  expect(
    await screen.findByLabelText('Message the assistant'),
  ).toBeInTheDocument();
});

test.each([
  ['?standalone=1', '/superset/dashboard/1/'],
  ['?standalone=2', '/superset/dashboard/1/'],
  ['?standalone=3', '/superset/dashboard/1/'],
  ['', '/embedded/abc123'],
])(
  'does not register the assistant for a chrome-less render (%s%s)',
  (search, pathname) => {
    enableFlag(true);
    window.history.replaceState({}, '', `${pathname}${search}`);

    // A screenshot for a report would otherwise capture the trigger, and an
    // embedded dashboard on someone else's site should not offer a chat panel.
    expect(registerAiAssistant()).toBeUndefined();
    expect(chat.getChat()).toBeUndefined();
  },
);

test.each(['', '?standalone=0', '?foo=1'])(
  'still registers the assistant for an ordinary page (%s)',
  search => {
    enableFlag(true);
    window.history.replaceState({}, '', `/superset/dashboard/1/${search}`);

    expect(registerAiAssistant()).toBeDefined();
    expect(chat.getChat()).toBeDefined();
  },
);
