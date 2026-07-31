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
import {
  useRef,
  useState,
  type CSSProperties,
  type JSX,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';

export interface Chip {
  key: string;
  label: ReactNode;
  /** Accessible name, when the visible label is not enough on its own. */
  ariaLabel?: string;
  pressed: boolean;
  onSelect: () => void;
  className?: string;
  style?: CSSProperties;
}

interface Props {
  label: string;
  chips: Chip[];
}

/**
 * A group of toggle chips with the WAI-ARIA toolbar keyboard behaviour: the
 * group is a single tab stop and the arrow keys move between chips inside it.
 * Without this, every chip is its own tab stop and a keyboard user has to tab
 * through the whole toolbar to reach the chart.
 */
export function ChipGroup({ label, chips }: Props): JSX.Element {
  const ref = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState<number | null>(null);
  // The tab stop lands on the selected chip, so returning to the group puts
  // focus on the state the user last chose.
  const selected = Math.max(
    0,
    chips.findIndex((c) => c.pressed),
  );
  const tabStop = focused ?? selected;

  function onKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>): void {
    const buttons = Array.from(
      ref.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    const i = buttons.indexOf(event.currentTarget);
    if (i === -1) return;
    let next: number | null = null;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown')
      next = (i + 1) % buttons.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp')
      next = (i - 1 + buttons.length) % buttons.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = buttons.length - 1;
    if (next === null) return;
    event.preventDefault();
    buttons[next].focus();
  }

  return (
    <div className="sv-chip-group" role="group" aria-label={label} ref={ref}>
      {chips.map((chip, i) => (
        <button
          key={chip.key}
          type="button"
          className={chip.className ? `sv-chip ${chip.className}` : 'sv-chip'}
          style={chip.style}
          aria-pressed={chip.pressed}
          aria-label={chip.ariaLabel}
          tabIndex={i === tabStop ? 0 : -1}
          onFocus={() => setFocused(i)}
          onBlur={(e) => {
            if (!ref.current?.contains(e.relatedTarget as Node | null))
              setFocused(null);
          }}
          onKeyDown={onKeyDown}
          onClick={chip.onSelect}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
