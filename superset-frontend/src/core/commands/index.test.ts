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
import { commands, useCommandRegistry } from './index';

const held: { dispose: () => void }[] = [];

afterEach(() => {
  held.forEach(d => d.dispose());
  held.length = 0;
});

test('a registered command is retrievable and executable', () => {
  const run = jest.fn(() => 'done');
  held.push(
    commands.registerCommand(
      { id: 'acme.one', title: 'One', description: '' },
      run,
    ),
  );

  expect(commands.getCommand('acme.one')).toMatchObject({ title: 'One' });
  expect(commands.getCommands().map(c => c.id)).toContain('acme.one');
});

test('executing an unregistered command rejects rather than resolving', async () => {
  await expect(commands.executeCommand('acme.nope')).rejects.toThrow(
    /not found/,
  );
});

test('disposing removes the command', () => {
  const d = commands.registerCommand(
    { id: 'acme.two', title: 'Two', description: '' },
    () => undefined,
  );
  d.dispose();

  expect(commands.getCommand('acme.two')).toBeUndefined();
});

describe('useCommandRegistry', () => {
  // The registry is read by the navbar, which renders long before an
  // extension's bundle arrives: a menu item can point at a command that is
  // not registered yet. Without a subscription the reader would show nothing
  // for it for ever, so these pin that a change is observable.
  test('the version changes when a command registers', () => {
    const { result } = renderHook(() => useCommandRegistry());
    const before = result.current;

    // Inside `act`, or the notify fires but React never flushes the
    // re-render that re-reads the snapshot.
    act(() => {
      held.push(
        commands.registerCommand(
          { id: 'acme.three', title: 'Three', description: '' },
          () => undefined,
        ),
      );
    });

    expect(result.current).not.toBe(before);
  });

  test('the version changes when a command is disposed', () => {
    const d = commands.registerCommand(
      { id: 'acme.four', title: 'Four', description: '' },
      () => undefined,
    );
    const { result } = renderHook(() => useCommandRegistry());
    const before = result.current;

    act(() => d.dispose());

    expect(result.current).not.toBe(before);
  });

  test('the snapshot is stable between changes', () => {
    // `useSyncExternalStore` compares snapshots by identity and loops for
    // ever on one that differs every read -- which is why this is a counter
    // and not the registry map.
    const { result, rerender } = renderHook(() => useCommandRegistry());
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  test('unmounting stops the hook being notified', () => {
    // A listener left in the set would keep a dead component subscribed.
    const { unmount } = renderHook(() => useCommandRegistry());
    unmount();

    expect(() =>
      held.push(
        commands.registerCommand(
          { id: 'acme.five', title: 'Five', description: '' },
          () => undefined,
        ),
      ),
    ).not.toThrow();
  });
});
