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
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { config } from './config';
import { embedSnippet } from './jsx';

/**
 * A "Code" button that opens the JSX needed to embed this one widget on its
 * own in a modal. The widget stays mounted underneath, so opening the code
 * does not reset its data or filters.
 */
export function WidgetCode({
  element,
  title,
}: {
  element: ReactNode;
  title?: string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const snippet = open ? embedSnippet(element, config.supersetUrl) : '';

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <>
      <button
        type="button"
        className="code-toggle"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {'</> Code'}
      </button>
      {open && (
        // A dialog closes on Escape by itself; the click below is only the
        // backdrop's dismiss, which has no keyboard equivalent to add.
        // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
        <dialog
          ref={dialogRef}
          className="code-modal"
          aria-label={title ? `Embed code: ${title}` : 'Embed code'}
          onClose={() => setOpen(false)}
          onClick={event => {
            // Clicks on the backdrop land on the dialog element itself.
            if (event.target === event.currentTarget)
              dialogRef.current?.close();
          }}
        >
          <header className="code-modal-header">
            <h2>{title ?? 'Embed code'}</h2>
            <button type="button" className="code-modal-button" onClick={copy}>
              {copied ? 'Copied' : 'Copy'}
            </button>
            <button
              type="button"
              className="code-modal-button"
              onClick={() => dialogRef.current?.close()}
            >
              Close
            </button>
          </header>
          <pre>
            <code>{snippet}</code>
          </pre>
        </dialog>
      )}
    </>
  );
}
