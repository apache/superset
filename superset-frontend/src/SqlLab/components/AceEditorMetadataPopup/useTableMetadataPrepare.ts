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
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useSchemas, useTablesQuery } from 'src/hooks/apiResources';
import type { SqlLabRootState } from 'src/SqlLab/types';
import useQueryEditor from 'src/SqlLab/hooks/useQueryEditor';
import {
  MetadataType,
  useTokenContext,
  ValidatorFuncType,
} from './AceEditorTokenProvider';

type Params = {
  dbId?: string | number;
  catalog?: string | null;
  schema?: string;
};

const stripQuotes = (value: string) =>
  /\s/.test(value) ? value.slice(1, -1) : value;

function useTableMetadataPrepare(params: Params) {
  const queryEditorId = useSelector<SqlLabRootState, string>(
    ({ sqlLab }) => sqlLab.tabHistory.slice(-1)[0],
  );
  const queryEditor = useQueryEditor(queryEditorId, [
    'dbId',
    'catalog',
    'schema',
  ]);
  const dbId = params.dbId ?? queryEditor.dbId;
  const catalog = params.catalog ?? queryEditor.catalog;
  const schema = params.schema ?? queryEditor.schema;

  const { currentData: schemaOptions } = useSchemas({
    dbId,
    catalog: catalog || undefined,
  });

  const schemas = useMemo(
    () =>
      dbId && schemaOptions
        ? Object.fromEntries(
            schemaOptions?.map(({ value }) => [
              value,
              {
                dbId,
                catalog,
                schema: value,
                type: 'schema',
              },
            ]),
          )
        : undefined,
    [dbId, catalog, schemaOptions],
  );

  const { currentData: tableData } = useTablesQuery(
    {
      dbId,
      catalog,
      schema,
      forceRefresh: false,
    },
    { skip: !dbId || !schema },
  );

  const fetchedTables = useMemo(
    () =>
      dbId && schema && tableData?.options
        ? Object.fromEntries(
            tableData.options.map(({ value, type }) => [
              value,
              {
                dbId,
                catalog,
                schema,
                title: `${schema}.${value}`,
                value,
                type,
              },
            ]),
          )
        : undefined,
    [tableData, dbId, catalog, schema],
  );

  const { setValidators } = useTokenContext();

  const schemasRef = useRef(schemas);
  const fetchedTablesRef = useRef(fetchedTables);
  schemasRef.current = schemas;
  fetchedTablesRef.current = fetchedTables;

  const validator = useCallback<ValidatorFuncType>(
    ({ token, siblingTokens }) => {
      const schemaValue =
        siblingTokens[token.index - 1]?.value === '.'
          ? stripQuotes(siblingTokens[token.index - 2]?.value)
          : undefined;
      const tokenValue = stripQuotes(token.value);
      if (schemaValue && schemasRef.current?.[schemaValue]) {
        return {
          ...schemasRef.current?.[schemaValue],
          value: token.value,
          title: `${schemaValue}.${token.value}`,
        };
      }
      return fetchedTablesRef.current?.[tokenValue];
    },
    [],
  );

  useEffect(() => {
    setValidators(MetadataType.TABLE, validator);
  }, [validator, setValidators]);
}

export default useTableMetadataPrepare;
