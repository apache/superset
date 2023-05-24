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
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useDispatch } from 'react-redux';
import { css, styled, usePrevious, t } from '@superset-ui/core';

import { areArraysShallowEqual } from 'src/reduxUtils';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import {
  queryEditorSetSelectedText,
  addTable,
  addDangerToast,
} from 'src/SqlLab/actions/sqlLab';
import {
  SCHEMA_AUTOCOMPLETE_SCORE,
  TABLE_AUTOCOMPLETE_SCORE,
  COLUMN_AUTOCOMPLETE_SCORE,
  SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
} from 'src/SqlLab/constants';
import {
  Editor,
  AceCompleterKeyword,
  FullSQLEditor as AceEditor,
} from 'src/components/AsyncAceEditor';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import { useSchemas, useTables } from 'src/hooks/apiResources';
import { useDatabaseFunctionsQuery } from 'src/hooks/apiResources/databaseFunctions';

type HotKey = {
  key: string;
  descr: string;
  name: string;
  func: () => void;
};

type AceEditorWrapperProps = {
  autocomplete: boolean;
  onBlur: (sql: string) => void;
  onChange: (sql: string) => void;
  queryEditorId: string;
  database: any;
  extendedTables?: Array<{ name: string; columns: any[] }>;
  height: string;
  hotkeys: HotKey[];
};

const StyledAceEditor = styled(AceEditor)`
  ${({ theme }) => css`
    && {
      // double class is better than !important
      border: 1px solid ${theme.colors.grayscale.light2};
      font-feature-settings: 'liga' off, 'calt' off;

      &.ace_autocomplete {
        // Use !important because Ace Editor applies extra CSS at the last second
        // when opening the autocomplete.
        width: ${theme.gridUnit * 130}px !important;
      }

      .ace_scroller {
        background-color: ${theme.colors.grayscale.light4};
      }
    }
  `}
`;

const AceEditorWrapper = ({
  autocomplete,
  onBlur = () => {},
  onChange = () => {},
  queryEditorId,
  database,
  extendedTables = [],
  height,
  hotkeys,
}: AceEditorWrapperProps) => {
  const dispatch = useDispatch();

  const queryEditor = useQueryEditor(queryEditorId, [
    'id',
    'dbId',
    'sql',
    'validationResult',
    'schema',
  ]);
  const { data: schemaOptions } = useSchemas({
    ...(autocomplete && { dbId: queryEditor.dbId }),
  });
  const { data: tableData } = useTables({
    ...(autocomplete && {
      dbId: queryEditor.dbId,
      schema: queryEditor.schema,
    }),
  });

  const { data: functionNames, isError } = useDatabaseFunctionsQuery(
    { dbId: queryEditor.dbId },
    { skip: !autocomplete || !queryEditor.dbId },
  );

  useEffect(() => {
    if (isError) {
      dispatch(
        addDangerToast(t('An error occurred while fetching function names.')),
      );
    }
  }, [dispatch, isError]);

  const currentSql = queryEditor.sql ?? '';

  // Loading schema, table and column names as auto-completable words
  const { schemas, schemaWords } = useMemo(
    () => ({
      schemas: schemaOptions ?? [],
      schemaWords: (schemaOptions ?? []).map(s => ({
        name: s.label,
        value: s.value,
        score: SCHEMA_AUTOCOMPLETE_SCORE,
        meta: 'schema',
      })),
    }),
    [schemaOptions],
  );
  const tables = tableData?.options ?? [];

  const [sql, setSql] = useState(currentSql);
  const [words, setWords] = useState<AceCompleterKeyword[]>([]);

  // The editor changeSelection is called multiple times in a row,
  // faster than React reconciliation process, so the selected text
  // needs to be stored out of the state to ensure changes to it
  // get saved immediately
  const currentSelectionCache = useRef('');

  useEffect(() => {
    // Making sure no text is selected from previous mount
    dispatch(queryEditorSetSelectedText(queryEditor, null));
    setAutoCompleter();
  }, []);

  const prevTables = usePrevious(tables) ?? [];
  const prevSchemas = usePrevious(schemas) ?? [];
  const prevExtendedTables = usePrevious(extendedTables) ?? [];
  const prevSql = usePrevious(currentSql);

  useEffect(() => {
    if (
      !areArraysShallowEqual(tables, prevTables) ||
      !areArraysShallowEqual(schemas, prevSchemas) ||
      !areArraysShallowEqual(extendedTables, prevExtendedTables)
    ) {
      setAutoCompleter();
    }
  }, [tables, schemas, extendedTables]);

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
  };

  const onChangeText = (text: string) => {
    setSql(text);
    onChange(text);
  };

  function setAutoCompleter() {
    const columns = {};

    const tableWords = tables.map(t => {
      const tableName = t.value;
      const extendedTable = extendedTables.find(et => et.name === tableName);
      const cols = extendedTable?.columns || [];
      cols.forEach(col => {
        columns[col.name] = null; // using an object as a unique set
      });

      return {
        name: t.label,
        value: tableName,
        score: TABLE_AUTOCOMPLETE_SCORE,
        meta: 'table',
      };
    });

    const columnWords = Object.keys(columns).map(col => ({
      name: col,
      value: col,
      score: COLUMN_AUTOCOMPLETE_SCORE,
      meta: 'column',
    }));

    const functionWords = (functionNames ?? []).map(func => ({
      name: func,
      value: func,
      score: SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
      meta: 'function',
    }));

    const completer = {
      insertMatch: (editor: Editor, data: any) => {
        if (data.meta === 'table') {
          dispatch(
            addTable(queryEditor, database, data.value, queryEditor.schema),
          );
        }

        let { caption } = data;
        if (data.meta === 'table' && caption.includes(' ')) {
          caption = `"${caption}"`;
        }

        // executing https://github.com/thlorenz/brace/blob/3a00c5d59777f9d826841178e1eb36694177f5e6/ext/language_tools.js#L1448
        editor.completer.insertMatch(
          `${caption}${['function', 'schema'].includes(data.meta) ? '' : ' '}`,
        );
      },
    };

    const words = schemaWords
      .concat(tableWords)
      .concat(columnWords)
      .concat(functionWords)
      .concat(sqlKeywords)
      .map(word => ({
        ...word,
        completer,
      }));

    setWords(words);
  }

  const getAceAnnotations = () => {
    const { validationResult } = queryEditor;
    const resultIsReady = validationResult?.completed;
    if (resultIsReady && validationResult?.errors?.length) {
      const errors = validationResult.errors.map((err: any) => ({
        type: 'error',
        row: err.line_number - 1,
        column: err.start_column - 1,
        text: err.message,
      }));
      return errors;
    }
    return [];
  };

  return (
    <StyledAceEditor
      keywords={words}
      onLoad={onEditorLoad}
      onBlur={onBlurSql}
      height={height}
      onChange={onChangeText}
      width="100%"
      editorProps={{ $blockScrolling: true }}
      enableLiveAutocompletion={autocomplete}
      value={sql}
      annotations={getAceAnnotations()}
    />
  );
};

export default AceEditorWrapper;
