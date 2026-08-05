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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

import { ExportMenu } from './ExportMenu';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;

const onCsv = vi.fn();

function render(node: JSX.Element): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(node);
  });
}

function renderMenu(note?: string): void {
  render(
    <ExportMenu
      note={note}
      actions={[
        { key: 'csv', label: 'Download CSV', onSelect: onCsv },
        { key: 'copy', label: 'Copy CSV', onSelect: vi.fn() },
      ]}
    />,
  );
}

function trigger(): HTMLButtonElement {
  return container!.querySelector(
    '[aria-haspopup="menu"]',
  ) as HTMLButtonElement;
}

function items(): HTMLButtonElement[] {
  return Array.from(container!.querySelectorAll('[role="menuitem"]'));
}

function press(key: string, target: EventTarget = document): void {
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
  });
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  container = null;
  root = null;
  vi.clearAllMocks();
});

test('the menu is closed until the trigger is used', () => {
  renderMenu();
  expect(trigger().getAttribute('aria-expanded')).toBe('false');
  expect(items()).toHaveLength(0);
  act(() => trigger().click());
  expect(trigger().getAttribute('aria-expanded')).toBe('true');
  expect(items().map((b) => b.textContent)).toEqual([
    'Download CSV',
    'Copy CSV',
  ]);
});

test('opening the menu moves focus to the first item', () => {
  renderMenu();
  act(() => trigger().click());
  expect(document.activeElement).toBe(items()[0]);
});

test('arrow keys cycle through the items', () => {
  renderMenu();
  act(() => trigger().click());
  press('ArrowDown', items()[0]);
  expect(document.activeElement).toBe(items()[1]);
  // Wraps around rather than dead-ending.
  press('ArrowDown', items()[1]);
  expect(document.activeElement).toBe(items()[0]);
  press('ArrowUp', items()[0]);
  expect(document.activeElement).toBe(items()[1]);
});

test('Escape closes the menu and returns focus to the trigger', () => {
  renderMenu();
  act(() => trigger().click());
  press('Escape');
  expect(items()).toHaveLength(0);
  expect(document.activeElement).toBe(trigger());
});

test('selecting an item runs it and closes the menu', () => {
  renderMenu();
  act(() => trigger().click());
  act(() => items()[0].click());
  expect(onCsv).toHaveBeenCalledOnce();
  expect(items()).toHaveLength(0);
});

test('clicking outside dismisses the menu', () => {
  renderMenu();
  act(() => trigger().click());
  act(() => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  });
  expect(items()).toHaveLength(0);
});

test('renders the explanation when downloads are unavailable', () => {
  renderMenu('This host sandboxes the widget.');
  act(() => trigger().click());
  expect(container!.querySelector('.sv-menu-note')!.textContent).toBe(
    'This host sandboxes the widget.',
  );
});

test('renders nothing at all when there is no action to offer', () => {
  render(<ExportMenu actions={[]} />);
  expect(container!.innerHTML).toBe('');
});
