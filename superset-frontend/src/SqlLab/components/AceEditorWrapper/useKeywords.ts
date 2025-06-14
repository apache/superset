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
import { useEffect, useMemo, useRef } from 'react';
import { useSelector, useDispatch, shallowEqual, useStore } from 'react-redux';
import { getExtensionsRegistry, t } from '@superset-ui/core';

import { Editor } from 'src/components/AsyncAceEditor';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { addTable, addDangerToast } from 'src/SqlLab/actions/sqlLab';
import {
  SCHEMA_AUTOCOMPLETE_SCORE,
  TABLE_AUTOCOMPLETE_SCORE,
  COLUMN_AUTOCOMPLETE_SCORE,
  SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
} from 'src/SqlLab/constants';
import {
  schemaEndpoints,
  tableEndpoints,
  skipToken,
} from 'src/hooks/apiResources';
import { api } from 'src/hooks/apiResources/queryApi';
import { useDatabaseFunctionsQuery } from 'src/hooks/apiResources/databaseFunctions';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { SqlLabRootState } from 'src/SqlLab/types';

type Params = {
  queryEditorId: string | number;
  dbId?: string | number;
  catalog?: string | null;
  schema?: string;
};

const EMPTY_LIST = [] as typeof sqlKeywords;

const { useQueryState: useSchemasQueryState } = schemaEndpoints.schemas;
const { useQueryState: useTablesQueryState } = tableEndpoints.tables;

const getHelperText = (value: string) =>
  value.length > 30 && {
    docText: value,
  };

const extensionsRegistry = getExtensionsRegistry();

export function useKeywords(
  { queryEditorId, dbId, catalog, schema }: Params,
  skip = false,
) {
  const useCustomKeywords = extensionsRegistry.get(
    'sqleditor.extension.customAutocomplete',
  );

  const customKeywords = useCustomKeywords?.({
    queryEditorId: String(queryEditorId),
    dbId,
    catalog,
    schema,
  });
  const dispatch = useDispatch();
  const hasFetchedKeywords = useRef(false);
  // skipFetch is used to prevent re-evaluating memoized keywords
  // due to updated api results by skip flag
  const skipFetch = hasFetchedKeywords && skip;
  const { currentData: schemaOptions } = useSchemasQueryState(
    {
      dbId,
      catalog: catalog || undefined,
      forceRefresh: false,
    },
    { skip: skipFetch || !dbId },
  );
  const { currentData: tableData } = useTablesQueryState(
    {
      dbId,
      catalog,
      schema,
      forceRefresh: false,
    },
    { skip: skipFetch || !dbId || !schema },
  );

  const { currentData: functionNames, isError } = useDatabaseFunctionsQuery(
    { dbId },
    { skip: skipFetch || !dbId },
  );

  useEffect(() => {
    if (isError) {
      dispatch(
        addDangerToast(t('An error occurred while fetching function names.')),
      );
    }
  }, [dispatch, isError]);

  const tablesForColumnMetadata = useSelector<SqlLabRootState, string[]>(
    ({ sqlLab }) =>
      skip
        ? []
        : (sqlLab?.tables ?? [])
            .filter(table => table.queryEditorId === queryEditorId)
            .map(table => table.name),
    shallowEqual,
  );

  const store = useStore();
  const apiState = store.getState()[api.reducerPath];

  const allColumns = useMemo(() => {
    const columns = new Set<string>();
    tablesForColumnMetadata.forEach(table => {
      tableEndpoints.tableMetadata
        .select(
          dbId && schema
            ? {
                dbId,
                catalog,
                schema,
                table,
              }
            : skipToken,
        )({
          [api.reducerPath]: apiState,
        })
        .data?.columns?.forEach(({ name }) => {
          columns.add(name);
        });
    });
    return [...columns];
  }, [dbId, catalog, schema, apiState, tablesForColumnMetadata]);

  const insertMatch = useEffectEvent((editor: Editor, data: any) => {
    if (data.meta === 'table') {
      dispatch(
        addTable({ id: queryEditorId, dbId }, data.value, catalog, schema),
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
  });

  const schemaKeywords = useMemo(
    () =>
      (schemaOptions ?? []).map(s => ({
        name: s.label,
        value: s.value,
        score: SCHEMA_AUTOCOMPLETE_SCORE,
        meta: 'schema',
        completer: {
          insertMatch,
        },
        ...getHelperText(s.value),
      })),
    [schemaOptions, insertMatch],
  );

  const tableKeywords = useMemo(
    () =>
      (tableData?.options ?? []).map(({ value, label }) => ({
        name: label,
        value,
        score: TABLE_AUTOCOMPLETE_SCORE,
        meta: 'table',
        completer: {
          insertMatch,
        },
        ...getHelperText(value),
      })),
    [tableData?.options, insertMatch],
  );

  const columnKeywords = useMemo(
    () =>
      allColumns.map(col => ({
        name: col,
        value: col,
        score: COLUMN_AUTOCOMPLETE_SCORE,
        meta: 'column',
        ...getHelperText(col),
      })),
    [allColumns],
  );

  const functionKeywords = useMemo(
    () =>
      (functionNames ?? []).map(func => ({
        name: func,
        value: func,
        score: SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
        meta: 'function',
        completer: {
          insertMatch,
        },
        ...getHelperText(func),
      })),
    [functionNames, insertMatch],
  );

  const keywords = useMemo(
    () =>
      columnKeywords
        .concat(schemaKeywords)
        .concat(tableKeywords)
        .concat(functionKeywords)
        .concat(sqlKeywords)
        .concat(customKeywords ?? []),
    [
      schemaKeywords,
      tableKeywords,
      columnKeywords,
      functionKeywords,
      customKeywords,
    ],
  );

  hasFetchedKeywords.current = !skip;

  return skip ? EMPTY_LIST : keywords;
}
