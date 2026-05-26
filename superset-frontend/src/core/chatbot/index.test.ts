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
import { views } from 'src/core/views';
import { CHATBOT_LOCATION } from 'src/views/contributions';
import { getActiveChatbot } from './index';

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('getActiveChatbot returns undefined when no chatbot is registered', () => {
  expect(getActiveChatbot()).toBeUndefined();
});

test('getActiveChatbot resolves the single registered chatbot', () => {
  const provider = () => React.createElement('div', null, 'Chatbot');
  disposables.push(
    views.registerView(
      { id: 'superset.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      provider,
    ),
  );

  const active = getActiveChatbot();
  expect(active).toEqual({ id: 'superset.chatbot', provider });
});

test('getActiveChatbot picks the first-to-register when multiple are installed', () => {
  const firstProvider = () => React.createElement('div', null, 'First');
  const secondProvider = () => React.createElement('div', null, 'Second');
  disposables.push(
    views.registerView(
      { id: 'first.chatbot', name: 'First Chatbot' },
      CHATBOT_LOCATION,
      firstProvider,
    ),
    views.registerView(
      { id: 'second.chatbot', name: 'Second Chatbot' },
      CHATBOT_LOCATION,
      secondProvider,
    ),
  );

  const active = getActiveChatbot();
  expect(active?.id).toBe('first.chatbot');
  expect(active?.provider).toBe(firstProvider);
});

test('getActiveChatbot ignores views registered at other locations', () => {
  const provider = () => React.createElement('div', null, 'Panel');
  disposables.push(
    views.registerView(
      { id: 'some.panel', name: 'Some Panel' },
      'sqllab.panels',
      provider,
    ),
  );

  expect(getActiveChatbot()).toBeUndefined();
});

test('getActiveChatbot stops resolving a chatbot once it is disposed', () => {
  const provider = () => React.createElement('div', null, 'Chatbot');
  const disposable = views.registerView(
    { id: 'superset.chatbot', name: 'Superset Chatbot' },
    CHATBOT_LOCATION,
    provider,
  );

  expect(getActiveChatbot()?.id).toBe('superset.chatbot');

  disposable.dispose();

  expect(getActiveChatbot()).toBeUndefined();
});
