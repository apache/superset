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
import { useEffect, useRef, useState, type JSX } from 'react';

export interface ExportAction {
  key: string;
  label: string;
  onSelect: () => void;
}

interface Props {
  actions: ExportAction[];
  /**
   * Explains why file downloads are missing, when they are. Shown inside the
   * menu so an absent button is never mistaken for a broken one.
   */
  note?: string;
}

/**
 * "Export" dropdown. A menu rather than a row of buttons because the offered
 * actions change with the host's sandbox and the active view, and a
 * shape-shifting toolbar is worse than one stable affordance.
 */
export function ExportMenu({ actions, note }: Props): JSX.Element | null {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Dismiss on outside click or Escape, and return focus to the trigger so
  // keyboard users are not stranded at the top of the document.
  useEffect(() => {
    if (!open) return undefined;
    const onDocPointerDown = (e: MouseEvent): void => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDocPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  // Move focus into the menu when it opens.
  useEffect(() => {
    if (open) {
      menuRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    }
  }, [open]);

  if (!actions.length) return null;

  function moveFocus(from: HTMLElement, delta: number): void {
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [],
    );
    const i = items.indexOf(from as HTMLButtonElement);
    if (i === -1) return;
    items[(i + delta + items.length) % items.length]?.focus();
  }

  return (
    <div className="sv-menu-root" ref={rootRef}>
      <button
        type="button"
        ref={triggerRef}
        className="sv-btn sv-btn--subtle"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <DownloadIcon />
        Export
      </button>
      {open && (
        <div className="sv-menu" role="menu" ref={menuRef} aria-label="Export">
          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              className="sv-menu-item"
              onClick={() => {
                setOpen(false);
                action.onSelect();
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  moveFocus(e.currentTarget, e.key === 'ArrowDown' ? 1 : -1);
                }
              }}
            >
              {action.label}
            </button>
          ))}
          {note && <p className="sv-menu-note">{note}</p>}
        </div>
      )}
    </div>
  );
}

function DownloadIcon(): JSX.Element {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
