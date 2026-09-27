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
import { type ReactNode, useEffect, useState } from 'react';
import { act, fireEvent, render, screen } from 'spec/helpers/testing-library';
import { chat } from 'src/core/chat';
import ChatProvider from 'src/core/chat/ChatProvider';
import App from './App';

jest.mock('src/setup/setupApp', () => jest.fn());
jest.mock('src/setup/setupPlugins', () => jest.fn());
jest.mock('src/setup/setupCodeOverrides', () => jest.fn());
jest.mock('@superset-ui/core/components/ThemedAgGridReact', () => ({
  setupAGGridModules: jest.fn(),
}));
jest.mock('src/features/home/Menu', () => () => null);
jest.mock('src/components/MessageToasts/ToastContainer', () => () => null);
jest.mock(
  'src/extensions/ExtensionsStartup',
  () =>
    ({ children }: { children: ReactNode }) =>
      children,
);
jest.mock('./RootContextProviders', () => ({
  RootContextProviders: ({ children }: { children: ReactNode }) => children,
}));
jest.mock('./routes', () => ({
  routes: [],
  isFrontendRoute: () => true,
}));
jest.mock('src/utils/getBootstrapData', () => {
  const original = jest.requireActual('src/utils/getBootstrapData');
  return {
    ...original,
    __esModule: true,
    default: () => ({
      ...original.default(),
      user: { userId: 1, username: 'admin', isAnonymous: false },
    }),
  };
});

test('changing chat display mode preserves the mounted panel and in-flight state', () => {
  ChatProvider.getInstance().reset();
  window.featureFlags = { ENABLE_EXTENSIONS: true };
  const stream = new EventTarget();
  const mounted = jest.fn();
  const unmounted = jest.fn();
  const Panel = () => {
    const [draft, setDraft] = useState('');
    const [answer, setAnswer] = useState('');
    useEffect(() => {
      mounted();
      const receive = () => setAnswer(previous => `${previous}chunk `);
      stream.addEventListener('chunk', receive);
      return () => {
        unmounted();
        stream.removeEventListener('chunk', receive);
      };
    }, []);
    return (
      <>
        <input
          aria-label="Draft"
          value={draft}
          onChange={event => setDraft(event.target.value)}
        />
        <p data-test="streamed-answer">{answer}</p>
        <details>
          <summary>Tool result</summary>
          <pre>Rows: 3</pre>
        </details>
      </>
    );
  };
  const registration = chat.registerChat(
    { id: 'stateful.chat', name: 'Stateful chat' },
    () => <button type="button">Open chat</button>,
    Panel,
  );
  const { unmount } = render(<App />);
  act(() => chat.open());
  const input = screen.getByRole('textbox', { name: 'Draft' });
  const answer = screen.getByTestId('streamed-answer');
  const details = screen.getByText('Tool result').closest('details');
  fireEvent.change(input, { target: { value: 'Unsent question' } });
  fireEvent.click(screen.getByText('Tool result'));
  act(() => stream.dispatchEvent(new Event('chunk')));

  for (const mode of ['panel', 'floating', 'panel', 'floating'] as const) {
    act(() => chat.setDisplayMode(mode));
    expect(screen.getByRole('textbox', { name: 'Draft' })).toBe(input);
    expect(input).toHaveValue('Unsent question');
    expect(screen.getByTestId('streamed-answer')).toBe(answer);
    expect(answer).toHaveTextContent('chunk');
    expect(details).toHaveAttribute('open');
    expect(mounted).toHaveBeenCalledTimes(1);
    expect(unmounted).not.toHaveBeenCalled();
  }
  act(() => stream.dispatchEvent(new Event('chunk')));
  expect(answer).toHaveTextContent('chunk chunk');
  act(() => chat.close());
  expect(unmounted).toHaveBeenCalledTimes(1);
  expect(
    screen.queryByRole('textbox', { name: 'Draft' }),
  ).not.toBeInTheDocument();
  unmount();
  registration.dispose();
  window.featureFlags = {};
});
