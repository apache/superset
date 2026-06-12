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
import { act, render, screen } from 'spec/helpers/testing-library';
import { chat } from 'src/core/chat';
import ChatMount from '.';

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  // Reset host-owned state shared across tests in this module.
  act(() => {
    chat.close();
    chat.setMode('floating');
  });
});

test('renders nothing when no chat extension is registered', () => {
  render(<ChatMount />);

  expect(screen.queryByTestId('chat-mount')).not.toBeInTheDocument();
});

test('renders the trigger bubble of the registered chat', () => {
  disposables.push(
    chat.registerChat(
      { id: 'acme.chat', name: 'Acme Chat' },
      () => <button type="button">Acme Bubble</button>,
      () => <div>Acme Panel</div>,
    ),
  );

  render(<ChatMount />);

  expect(screen.getByTestId('chat-mount')).toBeInTheDocument();
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();
  // The panel stays unmounted until the chat is opened.
  expect(screen.queryByText('Acme Panel')).not.toBeInTheDocument();
});

test('mounts the panel when the chat opens and unmounts it on close', () => {
  disposables.push(
    chat.registerChat(
      { id: 'acme.chat', name: 'Acme Chat' },
      () => <button type="button">Acme Bubble</button>,
      () => <div>Acme Panel</div>,
    ),
  );

  render(<ChatMount />);

  act(() => chat.open());

  expect(screen.getByText('Acme Panel')).toBeInTheDocument();
  // In floating mode the trigger stays mounted alongside the open panel.
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();

  act(() => chat.close());

  expect(screen.queryByText('Acme Panel')).not.toBeInTheDocument();
});

test('renders the last-registered chat when several are installed', () => {
  disposables.push(
    chat.registerChat(
      { id: 'first.chat', name: 'First Chat' },
      () => <div>First Bubble</div>,
      () => <div>First Panel</div>,
    ),
    chat.registerChat(
      { id: 'second.chat', name: 'Second Chat' },
      () => <div>Second Bubble</div>,
      () => <div>Second Panel</div>,
    ),
  );

  render(<ChatMount />);

  // Last-loaded wins: the second registration takes over the singleton slot.
  expect(screen.getByText('Second Bubble')).toBeInTheDocument();
  expect(screen.queryByText('First Bubble')).not.toBeInTheDocument();
});

test('reacts to a chat registering after the initial render', () => {
  render(<ChatMount />);

  expect(screen.queryByTestId('chat-mount')).not.toBeInTheDocument();

  act(() => {
    disposables.push(
      chat.registerChat(
        { id: 'acme.chat', name: 'Acme Chat' },
        () => <button type="button">Acme Bubble</button>,
        () => <div>Acme Panel</div>,
      ),
    );
  });

  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();
});

test('panel mode docks the open panel and hides the trigger', () => {
  disposables.push(
    chat.registerChat(
      { id: 'acme.chat', name: 'Acme Chat' },
      () => <button type="button">Acme Bubble</button>,
      () => <div>Acme Panel</div>,
    ),
  );

  render(<ChatMount />);

  act(() => {
    chat.setMode('panel');
    chat.open();
  });

  expect(screen.getByText('Acme Panel')).toBeInTheDocument();
  expect(screen.queryByText('Acme Bubble')).not.toBeInTheDocument();

  act(() => chat.close());

  // A closed chat in panel mode renders nothing — the trigger is hidden too.
  expect(screen.queryByTestId('chat-mount')).not.toBeInTheDocument();
});

test('isolates a failing chat so it does not crash the host', () => {
  const FailingTrigger = () => {
    throw new Error('chat blew up');
  };
  disposables.push(
    chat.registerChat(
      { id: 'acme.chat', name: 'Acme Chat' },
      () => <FailingTrigger />,
      () => <div>Acme Panel</div>,
    ),
  );

  // The host-owned error boundary catches the failure; render does not throw.
  expect(() => render(<ChatMount />)).not.toThrow();
  // The mount slot still renders (the boundary lives inside it), confirming
  // the provider was actually exercised and contained.
  expect(screen.getByTestId('chat-mount')).toBeInTheDocument();
});

test('isolates a chat whose provider function itself throws', () => {
  disposables.push(
    chat.registerChat(
      { id: 'acme.chat', name: 'Acme Chat' },
      () => {
        throw new Error('provider blew up');
      },
      () => <div>Acme Panel</div>,
    ),
  );

  // ChatRenderer wraps provider() in a component so ErrorBoundary catches
  // synchronous throws from the provider function, not just from its output.
  expect(() => render(<ChatMount />)).not.toThrow();
  expect(screen.getByTestId('chat-mount')).toBeInTheDocument();
});
