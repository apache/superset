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
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { usePrevious } from '@superset-ui/core';
import { css, useTheme } from '@apache-superset/core/ui';
import { Global } from '@emotion/react';
import type { editors } from '@apache-superset/core';

import { SQL_EDITOR_LEFTBAR_WIDTH } from 'src/SqlLab/constants';
import { queryEditorSetSelectedText } from 'src/SqlLab/actions/sqlLab';
import type { KeyboardShortcut } from 'src/SqlLab/components/KeyboardShortcutButton';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { SqlLabRootState, type CursorPosition } from 'src/SqlLab/types';
import { EditorHost } from 'src/core/editors';
import { useAnnotations } from './useAnnotations';
import { useKeywords } from './useKeywords';

type EditorHandle = editors.EditorHandle;
type EditorHotkey = editors.EditorHotkey;
type EditorAnnotation = editors.EditorAnnotation;

type HotKey = {
  key: KeyboardShortcut;
  descr?: string;
  name: string;
  func: (editor: EditorHandle) => void;
};

type EditorWrapperProps = {
  autocomplete: boolean;
  onBlur: (sql: string) => void;
  onChange: (sql: string) => void;
  queryEditorId: string;
  onCursorPositionChange: (position: CursorPosition) => void;
  height: string;
  hotkeys: HotKey[];
};

/**
 * Convert legacy HotKey format to EditorHotkey format.
 */
const convertHotkeys = (
  hotkeys: HotKey[],
  onRunQuery: () => void,
): EditorHotkey[] => {
  const result: EditorHotkey[] = [
    // Add the built-in run query hotkey
    {
      name: 'runQuery',
      key: 'Alt-enter',
      description: 'Run query',
      exec: () => onRunQuery(),
    },
  ];

  hotkeys.forEach(keyConfig => {
    result.push({
      name: keyConfig.name,
      key: keyConfig.key,
      description: keyConfig.descr,
      exec: keyConfig.func,
    });
  });

  return result;
};

/**
 * Ace annotation format returned from useAnnotations when data is available.
 */
type AceAnnotation = {
  row: number;
  column: number;
  text: string | null;
  type: string;
};

/**
 * Type guard to check if an annotation is in Ace format.
 */
const isAceAnnotation = (ann: unknown): ann is AceAnnotation =>
  typeof ann === 'object' &&
  ann !== null &&
  'row' in ann &&
  'column' in ann &&
  'text' in ann &&
  'type' in ann;

/**
 * Convert annotation array to EditorAnnotation format.
 * Handles the union type returned from useAnnotations.
 */
const convertAnnotations = (
  annotations?: unknown[],
): EditorAnnotation[] | undefined => {
  if (!annotations || annotations.length === 0) return undefined;
  // Check if first item is in Ace format (has row, column, text, type)
  if (!isAceAnnotation(annotations[0])) return undefined;
  return (annotations as AceAnnotation[]).map(ann => ({
    line: ann.row,
    column: ann.column,
    message: ann.text ?? '',
    severity: ann.type as EditorAnnotation['severity'],
  }));
};

/**
 * EditorWrapper component that renders the SQL editor using EditorHost.
 * Uses the default Ace editor or an extension-provided editor based on
 * what's registered with the editors API.
 */
const EditorWrapper = ({
  autocomplete,
  onBlur = () => {},
  onChange = () => {},
  queryEditorId,
  onCursorPositionChange,
  height,
  hotkeys,
}: EditorWrapperProps) => {
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, [
    'id',
    'dbId',
    'sql',
    'catalog',
    'schema',
    'templateParams',
    'tabViewId',
  ]);
  // Prevent a maximum update depth exceeded error
  // by skipping access the unsaved query editor state
  const cursorPosition = useSelector<SqlLabRootState, CursorPosition>(
    ({ sqlLab: { queryEditors } }) => {
      const editor = queryEditors.find(({ id }) => id === queryEditorId);
      return editor?.cursorPosition ?? { row: 0, column: 0 };
    },
    shallowEqual,
  );

  const currentSql = queryEditor.sql ?? '';
  const [sql, setSql] = useState(currentSql);
  const theme = useTheme();
  const editorHandleRef = useRef<EditorHandle | null>(null);

  // The editor changeSelection is called multiple times in a row,
  // faster than React reconciliation process, so the selected text
  // needs to be stored out of the state to ensure changes to it
  // get saved immediately
  const currentSelectionCache = useRef('');

  useEffect(() => {
    // Making sure no text is selected from previous mount
    dispatch(queryEditorSetSelectedText(queryEditor, null));
  }, []);

  const prevSql = usePrevious(currentSql);

  useEffect(() => {
    if (currentSql !== prevSql) {
      setSql(currentSql);
    }
  }, [currentSql]);

  const onBlurSql = useCallback(
    (value: string) => {
      onBlur(value);
    },
    [onBlur],
  );

  const onAltEnter = useCallback(() => {
    onBlur(sql);
  }, [onBlur, sql]);

  const onChangeText = useCallback(
    (text: string) => {
      if (text !== sql) {
        setSql(text);
        onChange(text);
      }
    },
    [sql, onChange],
  );

  // Handle cursor position changes
  const handleCursorPositionChange = useCallback(
    (pos: { line: number; column: number }) => {
      onCursorPositionChange({ row: pos.line, column: pos.column });
    },
    [onCursorPositionChange],
  );

  // Handle selection changes
  const handleSelectionChange = useCallback(
    (
      selections: Array<{
        start: { line: number; column: number };
        end: { line: number; column: number };
      }>,
    ) => {
      if (!editorHandleRef.current || selections.length === 0) {
        return;
      }

      const selectedText = editorHandleRef.current.getSelectedText();

      // Always clear selection state when text is empty, regardless of cache
      if (!selectedText) {
        if (currentSelectionCache.current) {
          dispatch(queryEditorSetSelectedText(queryEditor, null));
        }
        currentSelectionCache.current = '';
        return;
      }

      // Skip 1-character selections (backspace triggers these)
      // but still update cache to track state
      if (selectedText.length === 1) {
        currentSelectionCache.current = selectedText;
        return;
      }

      // Only dispatch if selection actually changed
      if (selectedText !== currentSelectionCache.current) {
        dispatch(queryEditorSetSelectedText(queryEditor, selectedText));
      }
      currentSelectionCache.current = selectedText;
    },
    [dispatch, queryEditor],
  );

  // Handle editor ready callback
  const handleEditorReady = useCallback(
    (handle: EditorHandle) => {
      editorHandleRef.current = handle;
      // Set initial cursor position
      const { row, column } = cursorPosition;
      handle.moveCursorToPosition({ line: row, column });
      handle.focus();
      handle.scrollToLine(row);
    },
    [cursorPosition],
  );

  const { data: annotations } = useAnnotations({
    dbId: queryEditor.dbId,
    catalog: queryEditor.catalog,
    schema: queryEditor.schema,
    sql: currentSql,
    templateParams: queryEditor.templateParams,
  });

  const keywords = useKeywords(
    {
      queryEditorId,
      dbId: queryEditor.dbId,
      catalog: queryEditor.catalog,
      schema: queryEditor.schema,
      tabViewId: queryEditor.tabViewId,
    },
    !autocomplete,
  );

  // Convert hotkeys and annotations for the editor
  const editorHotkeys = useMemo(
    () => convertHotkeys(hotkeys, onAltEnter),
    [hotkeys, onAltEnter],
  );
  const editorAnnotations = useMemo(
    () => convertAnnotations(annotations),
    [annotations],
  );

  // Metadata for the editor (e.g., database context for completions)
  const metadata = useMemo(
    () => ({
      dbId: queryEditor.dbId,
      catalog: queryEditor.catalog,
      schema: queryEditor.schema,
      queryEditorId,
    }),
    [queryEditor.dbId, queryEditor.catalog, queryEditor.schema, queryEditorId],
  );

  // Global styles for the editor
  const globalStyles = (
    <Global
      styles={css`
        .ace_text-layer {
          width: 100% !important;
        }

        .ace_content,
        .SqlEditor .sql-container .ace_gutter {
          background-color: ${theme.colorBgBase} !important;
        }

        .ace_gutter::after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          right: ${theme.sizeUnit * 2}px;
          width: 1px;
          height: 100%;
          background-color: ${theme.colorBorder};
        }

        .ace_gutter,
        .ace_scroller {
          background-color: ${theme.colorBgBase} !important;
        }

        .ace_autocomplete {
          // Use !important because Ace Editor applies extra CSS at the last second
          // when opening the autocomplete.
          width: ${theme.sizeUnit * 130}px !important;
        }

        .ace_completion-highlight {
          color: ${theme.colorPrimaryText} !important;
          background-color: ${theme.colorPrimaryBgHover};
        }

        .ace_tooltip {
          max-width: ${SQL_EDITOR_LEFTBAR_WIDTH}px;
        }

        .ace_scroller {
          background-color: ${theme.colorBgLayout};
        }
      `}
    />
  );

  return (
    <>
      {globalStyles}
      <EditorHost
        id={queryEditorId}
        value={sql}
        onChange={onChangeText}
        onBlur={onBlurSql}
        onCursorPositionChange={handleCursorPositionChange}
        onSelectionChange={handleSelectionChange}
        onReady={handleEditorReady}
        language="sql"
        tabSize={2}
        lineNumbers
        annotations={editorAnnotations}
        hotkeys={editorHotkeys}
        height={height}
        width="100%"
        metadata={metadata}
        keywords={keywords}
      />
    </>
  );
};

// Export with the legacy name for backward compatibility
export default EditorWrapper;
