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
import { useDispatch, useStore } from 'react-redux';
import { t } from '@apache-superset/core/translation';
import { getExtensionsRegistry } from '@superset-ui/core';

import type { Editor } from '@superset-ui/core/components';
import sqlKeywords from 'src/SqlLab/utils/sqlKeywords';
import { addTable, addDangerToast } from 'src/SqlLab/actions/sqlLab';
import {
  SCHEMA_AUTOCOMPLETE_SCORE,
  TABLE_AUTOCOMPLETE_SCORE,
  COLUMN_AUTOCOMPLETE_SCORE,
  SQL_FUNCTIONS_AUTOCOMPLETE_SCORE,
} from 'src/SqlLab/constants';
import { schemaEndpoints } from 'src/hooks/apiResources';
import { api } from 'src/hooks/apiResources/queryApi';
import { useDatabaseFunctionsQuery } from 'src/hooks/apiResources/databaseFunctions';
import useEffectEvent from 'src/hooks/useEffectEvent';

type Params = {
  queryEditorId: string | number;
  dbId?: string | number;
  catalog?: string | null;
  schema?: string;
  tabViewId?: string;
};

const EMPTY_LIST = [] as typeof sqlKeywords;

const { useQueryState: useSchemasQueryState } = schemaEndpoints.schemas;

const getHelperText = (value: string) =>
  value.length > 30 && {
    detail: value,
  };

const extensionsRegistry = getExtensionsRegistry();

export function useKeywords(
  { queryEditorId, dbId, catalog, schema, tabViewId }: Params,
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

  const store = useStore();
  const apiState = store.getState()[api.reducerPath];

  // Normalize catalog for comparison (null/undefined both mean "no catalog")
  const normalizedCatalog = catalog ?? null;

  // Collect all table names from all cached table-list queries for this database/catalog.
  // This includes tables from any schema the user has expanded in the tree.
  const allCachedTables = useMemo(() => {
    if (skipFetch || !dbId || !apiState) return [];
    const tables: { value: string; label: string; schema: string }[] = [];
    const seen = new Set<string>();
    const queries = apiState.queries ?? {};
    for (const entry of Object.values(queries) as any[]) {
      const arg = entry?.originalArgs;
      if (
        arg?.dbId === dbId &&
        (arg?.catalog ?? null) === normalizedCatalog &&
        entry?.status === 'fulfilled' &&
        entry?.data?.options
      ) {
        for (const table of entry.data.options) {
          const key = `${arg.schema}.${table.value}`;
          if (!seen.has(key)) {
            seen.add(key);
            tables.push({
              value: table.value,
              label: table.label ?? table.value,
              schema: arg.schema,
            });
          }
        }
      }
    }
    return tables;
  }, [dbId, normalizedCatalog, apiState, skipFetch]);

  // Collect column names from all cached table-metadata queries for this database/catalog.
  // This includes columns from any table the user has expanded in the tree.
  const allColumns = useMemo(() => {
    if (skipFetch || !dbId || !apiState) return [];
    const columns = new Set<string>();
    const queries = apiState.queries ?? {};
    for (const entry of Object.values(queries) as any[]) {
      const arg = entry?.originalArgs;
      if (
        entry?.status === 'fulfilled' &&
        entry?.data?.columns &&
        arg?.dbId === dbId &&
        (arg?.catalog ?? null) === normalizedCatalog
      ) {
        for (const col of entry.data.columns) {
          columns.add(col.name);
        }
      }
    }
    return [...columns];
  }, [dbId, normalizedCatalog, apiState, skipFetch]);

  const insertMatch = useEffectEvent((editor: Editor, data: any) => {
    if (data.meta === 'table') {
      dispatch(
        addTable(
          { id: String(queryEditorId), dbId: dbId as number, tabViewId },
          data.value,
          catalog ?? null,
          data.schema ?? schema ?? '',
          false, // Don't auto-expand/switch tabs when adding via autocomplete
        ),
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
      allCachedTables.map(({ value, label, schema: tableSchema }) => ({
        name: label,
        value,
        schema: tableSchema,
        score: TABLE_AUTOCOMPLETE_SCORE,
        meta: 'table',
        completer: {
          insertMatch,
        },
        ...getHelperText(value),
      })),
    [allCachedTables, insertMatch],
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
