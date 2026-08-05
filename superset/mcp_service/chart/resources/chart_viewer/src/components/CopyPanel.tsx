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
import { useEffect, useRef, type JSX } from 'react';

interface Props {
  title: string;
  text: string;
  onClose: () => void;
}

/**
 * Last-resort export path: show the text, pre-selected, so the user can copy
 * it with their own keystroke.
 *
 * Programmatic clipboard writes need the `clipboard-write` permission, which a
 * cross-origin host iframe does not grant by default. A user-initiated copy
 * out of a focused textarea needs no permission at all, so this always works.
 */
export function CopyPanel({ title, text, onClose }: Props): JSX.Element {
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    areaRef.current?.focus();
    areaRef.current?.select();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        // Dismiss this layer only; do not also collapse a maximized widget.
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="sv-panel-overlay">
      <div
        className="sv-panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="sv-panel-head">
          <strong>{title}</strong>
          <span className="sv-spacer" />
          <button
            type="button"
            className="sv-btn sv-btn--subtle"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <p className="sv-panel-hint">
          Select all (Ctrl/Cmd+A), then copy.
        </p>
        <textarea
          className="sv-panel-text"
          ref={areaRef}
          readOnly
          spellCheck={false}
          value={text}
        />
      </div>
    </div>
  );
}
