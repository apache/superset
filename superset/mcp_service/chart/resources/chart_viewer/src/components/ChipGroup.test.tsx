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

import { ChipGroup } from './ChipGroup';

(
  globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement | null = null;
let root: Root | null = null;
const onSelect = vi.fn();

function renderGroup(pressedIndex = 1): void {
  container = document.createElement('div');
  document.body.appendChild(container);
  act(() => {
    root = createRoot(container!);
    root.render(
      <ChipGroup
        label="View type"
        chips={['Line', 'Bar', 'Table'].map((label, i) => ({
          key: label,
          label,
          ariaLabel: `${label} view`,
          pressed: i === pressedIndex,
          onSelect: () => onSelect(label),
        }))}
      />,
    );
  });
}

function chips(): HTMLButtonElement[] {
  return Array.from(container!.querySelectorAll('button'));
}

function press(key: string, target: HTMLElement): void {
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

test('exposes the group and the pressed state to assistive tech', () => {
  renderGroup();
  const group = container!.querySelector('[role="group"]')!;
  expect(group.getAttribute('aria-label')).toBe('View type');
  expect(chips().map((c) => c.getAttribute('aria-pressed'))).toEqual([
    'false',
    'true',
    'false',
  ]);
  expect(chips()[0].getAttribute('aria-label')).toBe('Line view');
});

test('the group is a single tab stop, landing on the selected chip', () => {
  renderGroup(2);
  expect(chips().map((c) => c.tabIndex)).toEqual([-1, -1, 0]);
});

test('arrow keys move focus within the group and wrap around', () => {
  renderGroup(0);
  act(() => chips()[0].focus());
  press('ArrowRight', chips()[0]);
  expect(document.activeElement).toBe(chips()[1]);
  press('ArrowRight', chips()[1]);
  press('ArrowRight', chips()[2]);
  expect(document.activeElement).toBe(chips()[0]);
  press('ArrowLeft', chips()[0]);
  expect(document.activeElement).toBe(chips()[2]);
});

test('Home and End jump to the ends', () => {
  renderGroup(1);
  act(() => chips()[1].focus());
  press('End', chips()[1]);
  expect(document.activeElement).toBe(chips()[2]);
  press('Home', chips()[2]);
  expect(document.activeElement).toBe(chips()[0]);
});

test('the tab stop follows focus so Tab leaves from where the user is', () => {
  renderGroup(0);
  act(() => chips()[0].focus());
  press('ArrowRight', chips()[0]);
  expect(chips().map((c) => c.tabIndex)).toEqual([-1, 0, -1]);
});

test('arrow keys move focus without selecting (selection stays deliberate)', () => {
  renderGroup(0);
  act(() => chips()[0].focus());
  press('ArrowRight', chips()[0]);
  expect(onSelect).not.toHaveBeenCalled();
  act(() => (document.activeElement as HTMLButtonElement).click());
  expect(onSelect).toHaveBeenCalledWith('Bar');
});
