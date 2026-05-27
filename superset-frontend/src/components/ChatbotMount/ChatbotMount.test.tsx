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
import { render, screen } from 'spec/helpers/testing-library';
import { views } from 'src/core';
import { CHATBOT_LOCATION } from 'src/views/contributions';
import ChatbotMount from '.';

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
});

test('renders nothing when no chatbot extension is registered', () => {
  render(<ChatbotMount />);

  expect(screen.queryByTestId('chatbot-mount')).not.toBeInTheDocument();
});

test('renders the registered chatbot inside the fixed mount slot', () => {
  const provider = () => React.createElement('div', null, 'My Chatbot Bubble');
  disposables.push(
    views.registerView(
      { id: 'superset.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      provider,
    ),
  );

  render(<ChatbotMount />);

  expect(screen.getByTestId('chatbot-mount')).toBeInTheDocument();
  expect(screen.getByText('My Chatbot Bubble')).toBeInTheDocument();
});

test('renders only the first-to-register chatbot when several are installed', () => {
  const firstProvider = () => React.createElement('div', null, 'First Bubble');
  const secondProvider = () =>
    React.createElement('div', null, 'Second Bubble');
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

  render(<ChatbotMount />);

  expect(screen.getByText('First Bubble')).toBeInTheDocument();
  expect(screen.queryByText('Second Bubble')).not.toBeInTheDocument();
});

test('isolates a failing chatbot so it does not crash the host', () => {
  const FailingChatbot = () => {
    throw new Error('chatbot blew up');
  };
  disposables.push(
    views.registerView(
      { id: 'superset.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      () => React.createElement(FailingChatbot),
    ),
  );

  // The host-owned error boundary catches the failure; render does not throw.
  expect(() => render(<ChatbotMount />)).not.toThrow();
});

test('isolates a chatbot whose provider function itself throws', () => {
  disposables.push(
    views.registerView(
      { id: 'superset.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      () => {
        throw new Error('provider blew up');
      },
    ),
  );

  // ChatbotRenderer wraps provider() in a component so ErrorBoundary catches
  // synchronous throws from the provider function, not just from its output.
  expect(() => render(<ChatbotMount />)).not.toThrow();
});
