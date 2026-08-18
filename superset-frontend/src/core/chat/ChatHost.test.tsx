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
import ChatProvider from './ChatProvider';
import { ChatFloatingHost as ChatHost, ChatPanelHost } from './ChatHost';

beforeEach(() => {
  ChatProvider.getInstance().reset();
});

test('renders nothing when no chat extension is registered', () => {
  render(<ChatHost />);

  expect(screen.queryByTestId('chat-mount')).not.toBeInTheDocument();
});

test('renders the trigger bubble of the registered chat', () => {
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <button type="button">Acme Bubble</button>,
    () => <div>Acme Panel</div>,
  );

  render(<ChatHost />);

  expect(screen.getByTestId('chat-mount')).toBeInTheDocument();
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();
  // The panel stays unmounted until the chat is opened.
  expect(screen.queryByText('Acme Panel')).not.toBeInTheDocument();
});

test('mounts the panel when the chat opens and unmounts it on close', () => {
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <button type="button">Acme Bubble</button>,
    () => <div>Acme Panel</div>,
  );

  render(<ChatHost />);

  act(() => chat.open());

  expect(screen.getByText('Acme Panel')).toBeInTheDocument();
  // In floating mode the trigger stays mounted alongside the open panel.
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();

  act(() => chat.close());

  expect(screen.queryByText('Acme Panel')).not.toBeInTheDocument();
});

test('renders the last-registered chat when several are installed', () => {
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  chat.registerChat(
    { id: 'first.chat', name: 'First Chat' },
    () => <div>First Bubble</div>,
    () => <div>First Panel</div>,
  );
  chat.registerChat(
    { id: 'second.chat', name: 'Second Chat' },
    () => <div>Second Bubble</div>,
    () => <div>Second Panel</div>,
  );

  jest.restoreAllMocks();
  render(<ChatHost />);

  // Last-loaded wins: the second registration takes over the singleton slot.
  expect(screen.getByText('Second Bubble')).toBeInTheDocument();
  expect(screen.queryByText('First Bubble')).not.toBeInTheDocument();
});

test('reacts to a chat registering after the initial render', () => {
  render(<ChatHost />);

  expect(screen.queryByTestId('chat-mount')).not.toBeInTheDocument();

  act(() => {
    chat.registerChat(
      { id: 'acme.chat', name: 'Acme Chat' },
      () => <button type="button">Acme Bubble</button>,
      () => <div>Acme Panel</div>,
    );
  });

  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();
});

test('a takeover mounts the incoming chat closed', () => {
  chat.registerChat(
    { id: 'first.chat', name: 'First Chat' },
    () => <div>First Bubble</div>,
    () => <div>First Panel</div>,
  );

  render(<ChatHost />);
  act(() => chat.open());
  expect(screen.getByText('First Panel')).toBeInTheDocument();

  act(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    chat.registerChat(
      { id: 'second.chat', name: 'Second Chat' },
      () => <div>Second Bubble</div>,
      () => <div>Second Panel</div>,
    );
    jest.restoreAllMocks();
  });

  // The displaced chat's open state must not leak into the winner.
  expect(screen.getByText('Second Bubble')).toBeInTheDocument();
  expect(screen.queryByText('Second Panel')).not.toBeInTheDocument();
  expect(screen.queryByText('First Panel')).not.toBeInTheDocument();
});

test('ChatPanelHost renders the panel when open in panel mode', () => {
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <button type="button">Acme Bubble</button>,
    () => <div>Acme Panel</div>,
  );

  render(<ChatPanelHost />);

  act(() => {
    chat.setDisplayMode('panel');
    chat.open();
  });

  expect(screen.getByText('Acme Panel')).toBeInTheDocument();
});

test('ChatFloatingHost suppresses the floating panel in panel mode but keeps the trigger', () => {
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <button type="button">Acme Bubble</button>,
    () => <div>Acme Panel</div>,
  );

  render(<ChatHost />);

  act(() => {
    chat.setDisplayMode('panel');
    chat.open();
  });

  // In panel mode the floating panel is suppressed (ChatPanelHost owns that slot).
  expect(screen.queryByText('Acme Panel')).not.toBeInTheDocument();
  // The trigger stays rendered so the user can reopen after collapsing.
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();

  act(() => chat.close());

  // Trigger remains visible even when closed — it's the user's only way back.
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();
});

test('a crashing panel does not take the trigger down with it', () => {
  const FailingPanel = () => {
    throw new Error('panel blew up');
  };
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <button type="button">Acme Bubble</button>,
    () => <FailingPanel />,
  );

  render(<ChatHost />);
  act(() => chat.open());

  // The panel's boundary contains the crash; the trigger keeps rendering so
  // the user is not stranded without a way back.
  expect(screen.queryByText('panel blew up')).not.toBeInTheDocument();
  expect(screen.getByText('Acme Bubble')).toBeInTheDocument();
});

test('isolates a failing trigger so it does not crash the host', () => {
  const FailingTrigger = () => {
    throw new Error('chat blew up');
  };
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <FailingTrigger />,
    () => <div>Acme Panel</div>,
  );

  // The host-owned error boundary catches the failure; render does not throw.
  expect(() => render(<ChatHost />)).not.toThrow();
  // The mount slot still renders (the boundary lives inside it), confirming
  // the provider was actually exercised and contained.
  expect(screen.getByTestId('chat-mount')).toBeInTheDocument();
});

test('isolates a component that throws during render', () => {
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => {
      throw new Error('provider blew up');
    },
    () => <div>Acme Panel</div>,
  );

  expect(() => render(<ChatHost />)).not.toThrow();
  expect(screen.getByTestId('chat-mount')).toBeInTheDocument();
});

test('recovers from a crashed chat when a different chat takes over', () => {
  const FailingTrigger = () => {
    throw new Error('first chat blew up');
  };
  chat.registerChat(
    { id: 'first.chat', name: 'First Chat' },
    () => <FailingTrigger />,
    () => <div>First Panel</div>,
  );

  render(<ChatHost />);
  expect(screen.queryByText('Second Bubble')).not.toBeInTheDocument();

  act(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    chat.registerChat(
      { id: 'second.chat', name: 'Second Chat' },
      () => <div>Second Bubble</div>,
      () => <div>Second Panel</div>,
    );
    jest.restoreAllMocks();
  });

  // The boundary is keyed per registration, so the latched crash from the
  // first chat does not blank the second one.
  expect(screen.getByText('Second Bubble')).toBeInTheDocument();
});

test('recovers from a crashed chat when a different id takes over', () => {
  const FailingTrigger = () => {
    throw new Error('broken release');
  };
  chat.registerChat(
    { id: 'acme.chat', name: 'Acme Chat' },
    () => <FailingTrigger />,
    () => <div>Acme Panel</div>,
  );

  render(<ChatHost />);

  act(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    chat.registerChat(
      { id: 'fixed.chat', name: 'Fixed Chat' },
      () => <div>Fixed Bubble</div>,
      () => <div>Fixed Panel</div>,
    );
    jest.restoreAllMocks();
  });

  // Different id: boundary key changes, latch resets, fix renders.
  expect(screen.getByText('Fixed Bubble')).toBeInTheDocument();
});
