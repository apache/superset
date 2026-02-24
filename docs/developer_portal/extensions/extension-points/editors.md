---
title: Editors
sidebar_position: 2
---

<!--
Licensed to the Apache Software Foundation (ASF) under one
or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.  The ASF licenses this file
to you under the Apache License, Version 2.0 (the
"License"); you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

  http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing,
software distributed under the License is distributed on an
"AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, either express or implied.  See the License for the
specific language governing permissions and limitations
under the License.
-->

# Editor Contributions

Extensions can replace Superset's default text editors with custom implementations. This allows you to provide enhanced editing experiences using alternative editor frameworks like Monaco, CodeMirror, or custom solutions.

## Overview

Superset uses text editors in various places throughout the application:

| Language | Locations |
|----------|-----------|
| `sql` | SQL Lab, Metric/Filter Popovers |
| `json` | Dashboard Properties, Annotation Modal, Theme Modal |
| `css` | Dashboard Properties, CSS Template Modal |
| `markdown` | Dashboard Markdown component |
| `yaml` | Template Params Editor |

By registering an editor provider for a language, your extension replaces the default Ace editor in **all** locations that use that language.

## Manifest Configuration

Declare editor contributions in your `extension.json` manifest:

```json
{
  "name": "monaco-editor",
  "version": "1.0.0",
  "frontend": {
    "contributions": {
      "editors": [
        {
          "id": "monaco-editor.sql",
          "name": "Monaco SQL Editor",
          "languages": ["sql"],
          "description": "Monaco-based SQL editor with IntelliSense"
        }
      ]
    }
  }
}
```

## Implementing an Editor

Your editor component must implement the `EditorProps` interface and expose an `EditorHandle` via `forwardRef`. For the complete interface definitions, see `@apache-superset/core/api/editors.ts`.

### Key EditorProps

```typescript
interface EditorProps {
  /** Controlled value */
  value: string;
  /** Content change handler */
  onChange: (value: string) => void;
  /** Language mode for syntax highlighting */
  language: EditorLanguage;
  /** Keyboard shortcuts to register */
  hotkeys?: EditorHotkey[];
  /** Callback when editor is ready with imperative handle */
  onReady?: (handle: EditorHandle) => void;
  /** Host-specific context (e.g., database info from SQL Lab) */
  metadata?: Record<string, unknown>;
  // ... additional props for styling, annotations, etc.
}
```

### Key EditorHandle Methods

```typescript
interface EditorHandle {
  /** Focus the editor */
  focus(): void;
  /** Get the current editor content */
  getValue(): string;
  /** Get the current cursor position */
  getCursorPosition(): Position;
  /** Move the cursor to a specific position */
  moveCursorToPosition(position: Position): void;
  /** Set the selection range */
  setSelection(selection: Range): void;
  /** Scroll to a specific line */
  scrollToLine(line: number): void;
  // ... additional methods for text manipulation, annotations, etc.
}
```

## Example Implementation

Here's an example of a Monaco-based SQL editor implementing the key interfaces shown above:

### MonacoSQLEditor.tsx

```typescript
import { forwardRef, useRef, useImperativeHandle, useEffect } from 'react';
import * as monaco from 'monaco-editor';
import type { editors } from '@apache-superset/core';

const MonacoSQLEditor = forwardRef<editors.EditorHandle, editors.EditorProps>(
  (props, ref) => {
    const { value, onChange, hotkeys, onReady } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

    // Implement EditorHandle interface
    const handle: editors.EditorHandle = {
      focus: () => editorRef.current?.focus(),
      getValue: () => editorRef.current?.getValue() ?? '',
      getCursorPosition: () => {
        const pos = editorRef.current?.getPosition();
        return { line: (pos?.lineNumber ?? 1) - 1, column: (pos?.column ?? 1) - 1 };
      },
      // ... implement remaining methods
    };

    useImperativeHandle(ref, () => handle, []);

    useEffect(() => {
      if (!containerRef.current) return;

      const editor = monaco.editor.create(containerRef.current, { value, language: 'sql' });
      editorRef.current = editor;

      editor.onDidChangeModelContent(() => onChange(editor.getValue()));

      // Register hotkeys
      hotkeys?.forEach(hotkey => {
        editor.addAction({
          id: hotkey.name,
          label: hotkey.name,
          run: () => hotkey.exec(handle),
        });
      });

      onReady?.(handle);
      return () => editor.dispose();
    }, []);

    return <div ref={containerRef} style={{ height: '100%', width: '100%' }} />;
  },
);

export default MonacoSQLEditor;
```

### activate.ts

```typescript
import { editors } from '@apache-superset/core';
import MonacoSQLEditor from './MonacoSQLEditor';

export function activate(context) {
  // Register the Monaco editor for SQL using the contribution ID from extension.json
  const disposable = editors.registerEditorProvider(
    'monaco-sql-editor.sql',
    MonacoSQLEditor,
  );

  context.subscriptions.push(disposable);
}
```

## Handling Hotkeys

Superset passes keyboard shortcuts via the `hotkeys` prop. Each hotkey includes an `exec` function that receives the `EditorHandle`:

```typescript
interface EditorHotkey {
  name: string;
  key: string;  // e.g., "Ctrl-Enter", "Alt-Shift-F"
  description?: string;
  exec: (handle: EditorHandle) => void;
}
```

Your editor must register these hotkeys with your editor framework and call `exec(handle)` when triggered.

## Keywords

Superset passes static autocomplete suggestions via the `keywords` prop. These include table names, column names, and SQL functions based on the current database context:

```typescript
interface EditorKeyword {
  name: string;
  value?: string;  // Text to insert (defaults to name)
  meta?: string;   // Category like "table", "column", "function"
  score?: number;  // Sorting priority
}
```

Your editor should convert these to your framework's completion format and register them for autocomplete.

## Completion Providers

For dynamic autocomplete (e.g., fetching suggestions as the user types), implement and register a `CompletionProvider` via the `EditorHandle`:

```typescript
const provider: CompletionProvider = {
  id: 'my-sql-completions',
  triggerCharacters: ['.', ' '],
  provideCompletions: async (content, position, context) => {
    // Use context.metadata for database info
    // Return array of CompletionItem
    return [
      { label: 'SELECT', insertText: 'SELECT', kind: 'keyword' },
      // ...
    ];
  },
};

// Register during editor initialization
const disposable = handle.registerCompletionProvider(provider);
```

## Next Steps

- **[SQL Lab Extension Points](./sqllab)** - Learn about other SQL Lab customizations
- **[Contribution Types](../contribution-types)** - Explore other contribution types
- **[Development](../development)** - Set up your development environment
