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
import { render, screen } from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import { views } from 'src/core';
import { loadExtensionSettings } from 'src/core/extensions';
import { CHATBOT_LOCATION } from 'src/views/contributions';
import ChatbotMount from '.';

const disposables: Array<{ dispose: () => void }> = [];

beforeEach(async () => {
  // The settings store is a module singleton; reset it to the empty default
  // (no admin pin) before each test by loading from a mocked API response.
  jest.spyOn(SupersetClient, 'get').mockResolvedValue({
    json: { result: { active_chatbot_id: null } },
  } as any);
  await loadExtensionSettings();
});

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  jest.restoreAllMocks();
});

test('renders nothing when no chatbot extension is registered', async () => {
  render(<ChatbotMount />);

  // Wait a tick for the settings load to resolve; the corner must stay empty
  // even after the gate opens (no chatbot registered → nothing to render).
  await Promise.resolve();
  expect(screen.queryByTestId('chatbot-mount')).not.toBeInTheDocument();
});

test('renders the registered chatbot inside the fixed mount slot', async () => {
  const provider = () => <div>My Chatbot Bubble</div>;
  disposables.push(
    views.registerView(
      { id: 'core.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      provider,
    ),
  );

  render(<ChatbotMount />);

  // findBy* awaits the re-render after the initial settings load resolves.
  expect(await screen.findByTestId('chatbot-mount')).toBeInTheDocument();
  expect(screen.getByText('My Chatbot Bubble')).toBeInTheDocument();
});

test('renders only the first-to-register chatbot when several are installed', async () => {
  const firstProvider = () => <div>First Bubble</div>;
  const secondProvider = () => <div>Second Bubble</div>;
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

  expect(await screen.findByText('First Bubble')).toBeInTheDocument();
  expect(screen.queryByText('Second Bubble')).not.toBeInTheDocument();
});

test('isolates a failing chatbot so it does not crash the host', async () => {
  const FailingChatbot = () => {
    throw new Error('chatbot blew up');
  };
  disposables.push(
    views.registerView(
      { id: 'core.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      () => <FailingChatbot />,
    ),
  );

  // The host-owned error boundary catches the failure; render does not throw.
  expect(() => render(<ChatbotMount />)).not.toThrow();
  // The mount slot still renders post-gate (the boundary lives inside it);
  // awaiting it confirms the provider was actually exercised and contained.
  expect(await screen.findByTestId('chatbot-mount')).toBeInTheDocument();
});

test('isolates a chatbot whose provider function itself throws', async () => {
  disposables.push(
    views.registerView(
      { id: 'core.chatbot', name: 'Superset Chatbot' },
      CHATBOT_LOCATION,
      () => {
        throw new Error('provider blew up');
      },
    ),
  );

  // ChatbotRenderer wraps provider() in a component so ErrorBoundary catches
  // synchronous throws from the provider function, not just from its output.
  expect(() => render(<ChatbotMount />)).not.toThrow();
  expect(await screen.findByTestId('chatbot-mount')).toBeInTheDocument();
});
