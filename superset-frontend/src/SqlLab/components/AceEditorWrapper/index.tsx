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
import { useState, useEffect, useRef } from 'react';
import type { IAceEditor } from 'react-ace/lib/types';
import { shallowEqual, useDispatch, useSelector } from 'react-redux';
import { css, styled, usePrevious, useTheme } from '@superset-ui/core';
import { Global } from '@emotion/react';

import { SQL_EDITOR_LEFTBAR_WIDTH } from 'src/SqlLab/constants';
import { queryEditorSetSelectedText } from 'src/SqlLab/actions/sqlLab';
import { FullSQLEditor as AceEditor } from 'src/components/AsyncAceEditor';
import type { KeyboardShortcut } from 'src/SqlLab/components/KeyboardShortcutButton';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { SqlLabRootState, type CursorPosition } from 'src/SqlLab/types';
import { useAnnotations } from './useAnnotations';
import { useKeywords } from './useKeywords';

type HotKey = {
  key: KeyboardShortcut;
  descr?: string;
  name: string;
  func: (aceEditor: IAceEditor) => void;
};

type AceEditorWrapperProps = {
  autocomplete: boolean;
  onBlur: (sql: string) => void;
  onChange: (sql: string) => void;
  queryEditorId: string;
  onCursorPositionChange: (position: CursorPosition) => void;
  height: string;
  hotkeys: HotKey[];
};

const StyledAceEditor = styled(AceEditor)`
  ${({ theme }) => css`
    && {
      // double class is better than !important
      border: 1px solid ${theme.colors.grayscale.light2};
      font-feature-settings:
        'liga' off,
        'calt' off;
    }
  `}
`;

const AceEditorWrapper = ({
  autocomplete,
  onBlur = () => {},
  onChange = () => {},
  queryEditorId,
  onCursorPositionChange,
  height,
  hotkeys,
}: AceEditorWrapperProps) => {
  const dispatch = useDispatch();
  const queryEditor = useQueryEditor(queryEditorId, [
    'id',
    'dbId',
    'sql',
    'catalog',
    'schema',
    'templateParams',
  ]);
  // Prevent a maximum update depth exceeded error
  // by skipping access the unsaved query editor state
  const cursorPosition = useSelector<SqlLabRootState, CursorPosition>(
    ({ sqlLab: { queryEditors } }) => {
      const { cursorPosition } = {
        ...queryEditors.find(({ id }) => id === queryEditorId),
      };
      return cursorPosition ?? { row: 0, column: 0 };
    },
    shallowEqual,
  );

  const currentSql = queryEditor.sql ?? '';
  const [sql, setSql] = useState(currentSql);

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

  const onBlurSql = () => {
    onBlur(sql);
  };

  const onAltEnter = () => {
    onBlur(sql);
  };

  const onEditorLoad = (editor: any) => {
    editor.commands.addCommand({
      name: 'runQuery',
      bindKey: { win: 'Alt-enter', mac: 'Alt-enter' },
      exec: () => {
        onAltEnter();
      },
    });

    hotkeys.forEach(keyConfig => {
      editor.commands.addCommand({
        name: keyConfig.name,
        bindKey: { win: keyConfig.key, mac: keyConfig.key },
        exec: keyConfig.func,
      });
    });

    editor.$blockScrolling = Infinity; // eslint-disable-line no-param-reassign
    editor.selection.on('changeSelection', () => {
      const selectedText = editor.getSelectedText();

      // Backspace trigger 1 character selection, ignoring
      if (
        selectedText !== currentSelectionCache.current &&
        selectedText.length !== 1
      ) {
        dispatch(queryEditorSetSelectedText(queryEditor, selectedText));
      }

      currentSelectionCache.current = selectedText;
    });
    editor.selection.on('changeCursor', () => {
      const cursor = editor.getCursorPosition();
      onCursorPositionChange(cursor);
    });

    const { row, column } = cursorPosition;
    editor.moveCursorToPosition({ row, column });
    editor.focus();
    editor.scrollToLine(row, true, true);
  };

  const onChangeText = (text: string) => {
    if (text !== sql) {
      setSql(text);
      onChange(text);
    }
  };

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
    },
    !autocomplete,
  );
  const theme = useTheme();

  return (
    <>
      <Global
        styles={css`
          .ace_text-layer {
            width: 100% !important;
          }

          .ace_autocomplete {
            // Use !important because Ace Editor applies extra CSS at the last second
            // when opening the autocomplete.
            width: ${theme.gridUnit * 130}px !important;
          }

          .ace_tooltip {
            max-width: ${SQL_EDITOR_LEFTBAR_WIDTH}px;
          }

          .ace_scroller {
            background-color: ${theme.colors.grayscale.light4};
          }
        `}
      />
      <StyledAceEditor
        keywords={keywords}
        onLoad={onEditorLoad}
        onBlur={onBlurSql}
        height={height}
        onChange={onChangeText}
        width="100%"
        editorProps={{ $blockScrolling: true }}
        enableLiveAutocompletion={autocomplete}
        value={sql}
        annotations={annotations}
      />
    </>
  );
};

export default AceEditorWrapper;
