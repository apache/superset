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

/**
 * @fileoverview Default Ace Editor provider implementation.
 *
 * This module wraps the existing Ace editor components to implement the
 * standard EditorProps interface, serving as the default editor when no
 * extension provides a custom implementation.
 */

import {
  useRef,
  useEffect,
  useCallback,
  useImperativeHandle,
  forwardRef,
  useMemo,
  type Ref,
} from 'react';
import type AceEditor from 'react-ace';
import type { editors } from '@apache-superset/core';
import {
  FullSQLEditor,
  JsonEditor,
  MarkdownEditor,
  CssEditor,
  ConfigEditor,
  type AceCompleterKeyword,
} from '@superset-ui/core/components';
import { Disposable } from '../models';

type EditorKeyword = editors.EditorKeyword;
type EditorProps = editors.EditorProps;
type EditorHandle = editors.EditorHandle;
type Position = editors.Position;
type Range = editors.Range;
type Selection = editors.Selection;
type EditorAnnotation = editors.EditorAnnotation;
type CompletionProvider = editors.CompletionProvider;

/**
 * Maps EditorLanguage to the corresponding Ace editor component.
 */
const getEditorComponent = (language: string) => {
  switch (language) {
    case 'sql':
      return FullSQLEditor;
    case 'json':
      return JsonEditor;
    case 'markdown':
      return MarkdownEditor;
    case 'css':
      return CssEditor;
    case 'yaml':
      return ConfigEditor;
    default:
      console.warn(
        `Unknown editor language "${language}", falling back to SQL editor`,
      );
      return FullSQLEditor;
  }
};

/**
 * Converts EditorAnnotation to Ace annotation format.
 */
const toAceAnnotation = (annotation: EditorAnnotation) => ({
  row: annotation.line,
  column: annotation.column ?? 0,
  text: annotation.message,
  type: annotation.severity,
});

/**
 * Creates an EditorHandle implementation backed by an Ace editor instance.
 */
const createAceEditorHandle = (
  aceEditorRef: React.RefObject<AceEditor>,
  completionProviders: React.MutableRefObject<Map<string, CompletionProvider>>,
): EditorHandle => ({
  focus: () => {
    aceEditorRef.current?.editor?.focus();
  },

  getValue: () => aceEditorRef.current?.editor?.getValue() ?? '',

  setValue: (value: string) => {
    aceEditorRef.current?.editor?.setValue(value, -1);
  },

  getCursorPosition: (): Position => {
    const pos = aceEditorRef.current?.editor?.getCursorPosition();
    return {
      line: pos?.row ?? 0,
      column: pos?.column ?? 0,
    };
  },

  moveCursorToPosition: (position: Position) => {
    aceEditorRef.current?.editor?.moveCursorToPosition({
      row: position.line,
      column: position.column,
    });
  },

  getSelections: (): Selection[] => {
    const selection = aceEditorRef.current?.editor?.getSelection();
    if (!selection) return [];
    const range = selection.getRange();
    return [
      {
        start: { line: range.start.row, column: range.start.column },
        end: { line: range.end.row, column: range.end.column },
      },
    ];
  },

  setSelection: (range: Range) => {
    const editor = aceEditorRef.current?.editor;
    if (editor) {
      editor.selection.setSelectionRange({
        start: { row: range.start.line, column: range.start.column },
        end: { row: range.end.line, column: range.end.column },
      });
    }
  },

  getSelectedText: () => aceEditorRef.current?.editor?.getSelectedText() ?? '',

  insertText: (text: string) => {
    aceEditorRef.current?.editor?.insert(text);
  },

  executeCommand: (commandName: string) => {
    const editor = aceEditorRef.current?.editor;
    if (editor?.commands) {
      editor.commands.exec(commandName, editor, {});
    }
  },

  scrollToLine: (line: number) => {
    aceEditorRef.current?.editor?.scrollToLine(line, true, true);
  },

  setAnnotations: (annotations: EditorAnnotation[]) => {
    const session = aceEditorRef.current?.editor?.getSession();
    if (session) {
      session.setAnnotations(annotations.map(toAceAnnotation));
    }
  },

  clearAnnotations: () => {
    const session = aceEditorRef.current?.editor?.getSession();
    if (session) {
      session.clearAnnotations();
    }
  },

  registerCompletionProvider: (provider: CompletionProvider): Disposable => {
    completionProviders.current.set(provider.id, provider);
    return new Disposable(() => {
      completionProviders.current.delete(provider.id);
    });
  },
});

/**
 * Converts generic EditorKeyword to Ace's AceCompleterKeyword format.
 */
const toAceKeyword = (keyword: EditorKeyword): AceCompleterKeyword => ({
  name: keyword.name,
  value: keyword.value ?? keyword.name,
  score: keyword.score ?? 0,
  meta: keyword.meta ?? '',
  docText: keyword.detail,
  docHTML: keyword.documentation,
});

/**
 * Default Ace-based editor provider component.
 * Implements the standard EditorProps interface while wrapping the existing
 * Ace editor components.
 */
const AceEditorProvider = forwardRef<EditorHandle, EditorProps>(
  (props, ref) => {
    const {
      id,
      value,
      onChange,
      onBlur,
      onCursorPositionChange,
      onSelectionChange,
      language,
      readOnly,
      tabSize,
      lineNumbers,
      wordWrap,
      annotations,
      hotkeys,
      keywords,
      height = '100%',
      width = '100%',
      onReady,
    } = props;

    const aceEditorRef = useRef<AceEditor>(null);
    const completionProviders = useRef<Map<string, CompletionProvider>>(
      new Map(),
    );

    // Use refs to store latest callbacks to avoid stale closures in event listeners
    const onCursorPositionChangeRef = useRef(onCursorPositionChange);
    const onSelectionChangeRef = useRef(onSelectionChange);

    // Keep refs up to date
    useEffect(() => {
      onCursorPositionChangeRef.current = onCursorPositionChange;
    }, [onCursorPositionChange]);

    useEffect(() => {
      onSelectionChangeRef.current = onSelectionChange;
    }, [onSelectionChange]);

    // Create the handle (memoized to prevent recreation on every render)
    const handle = useMemo(
      () => createAceEditorHandle(aceEditorRef, completionProviders),
      [],
    );

    // Expose handle via ref
    useImperativeHandle(ref, () => handle, [handle]);

    // Track if onReady has been called to prevent multiple calls
    const onReadyCalledRef = useRef(false);

    // Track if event listeners have been registered to prevent duplicates
    const listenersRegisteredRef = useRef(false);

    // Handle editor load
    const onEditorLoad = useCallback(
      (editor: AceEditor['editor']) => {
        // Register hotkeys
        if (hotkeys) {
          hotkeys.forEach(hotkey => {
            editor.commands.addCommand({
              name: hotkey.name,
              bindKey: { win: hotkey.key, mac: hotkey.key },
              exec: () => hotkey.exec(handle),
            });
          });
        }

        // Only register event listeners once to prevent duplicates
        if (!listenersRegisteredRef.current) {
          listenersRegisteredRef.current = true;

          // Set up cursor position change listener using ref to avoid stale closures
          editor.selection.on('changeCursor', () => {
            if (onCursorPositionChangeRef.current) {
              const cursor = editor.getCursorPosition();
              onCursorPositionChangeRef.current({
                line: cursor.row,
                column: cursor.column,
              });
            }
          });

          // Set up selection change listener using ref to avoid stale closures
          editor.selection.on('changeSelection', () => {
            if (onSelectionChangeRef.current) {
              const range = editor.getSelection().getRange();
              onSelectionChangeRef.current([
                {
                  start: { line: range.start.row, column: range.start.column },
                  end: { line: range.end.row, column: range.end.column },
                },
              ]);
            }
          });
        }

        // Notify when ready (only once) - must be done here after editor is loaded
        if (onReady && !onReadyCalledRef.current) {
          onReadyCalledRef.current = true;
          onReady(handle);
        }

        // Focus the editor
        editor.focus();
      },
      [hotkeys, handle, onReady],
    );

    // Handle blur
    const handleBlur = useCallback(() => {
      if (onBlur) {
        onBlur(value);
      }
    }, [onBlur, value]);

    // Get the appropriate editor component
    const EditorComponent = getEditorComponent(language);

    // Convert annotations to Ace format
    const aceAnnotations = annotations?.map(toAceAnnotation);

    // Convert generic keywords to Ace format
    const aceKeywords = keywords?.map(toAceKeyword);

    return (
      <EditorComponent
        ref={aceEditorRef as Ref<never>}
        name={id}
        mode={language}
        value={value}
        onChange={onChange}
        onBlur={handleBlur}
        onLoad={onEditorLoad}
        height={height}
        width={width}
        readOnly={readOnly}
        tabSize={tabSize}
        showGutter={lineNumbers !== false}
        wrapEnabled={wordWrap}
        annotations={aceAnnotations}
        keywords={aceKeywords}
        enableLiveAutocompletion
        editorProps={{ $blockScrolling: true }}
        showLoadingForImport
      />
    );
  },
);

AceEditorProvider.displayName = 'AceEditorProvider';

export default AceEditorProvider;
