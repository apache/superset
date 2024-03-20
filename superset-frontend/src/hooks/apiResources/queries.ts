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
import type { Query, QueryResponse } from '@superset-ui/core';
import type { JsonResponse } from './queryApi';
import { api } from './queryApi';

export type QueryResult = {
  count: number;
  ids: Query['id'][];
  result: QueryResponse[];
};

export type EditorQueriesParams = {
  editorId: string;
  pageIndex?: number;
  pageSize?: number;
};

interface ResponseResult {
  id: Query['queryId'];
  client_id: Query['id'];
  database: {
    id: Query['dbId'];
    database_name: string;
  };
  executed_sql: Query['executedSql'];
  error_message: Query['errorMessage'];
  limit: Query['queryLimit'];
  limiting_factor: Query['limitingFactor'];
  progress: Query['progress'];
  rows: Query['rows'];
  select_as_cta: Query['ctas'];
  schema: Query['schema'];
  sql: Query['sql'];
  sql_editor_id: Query['sqlEditorId'];
  status: Query['state'];
  tab_name: Query['tab'];
  user: {
    id: Query['userId'];
  };
  start_time: string;
  end_time: string;
  tmp_table_name: Query['tempTable'] | null;
  tracking_url: Query['trackingUrl'];
  results_key: Query['resultsKey'];
}

export const mapQueryResponse = (
  query: ResponseResult,
): Omit<
  Query,
  | 'tempSchema'
  | 'started'
  | 'time'
  | 'duration'
  | 'templateParams'
  | 'querylink'
  | 'output'
  | 'actions'
  | 'type'
  | 'columns'
> => ({
  queryId: query.id,
  id: query.client_id,
  dbId: query.database.id,
  db: query.database,
  executedSql: query.executed_sql,
  errorMessage: query.error_message,
  queryLimit: query.limit,
  ctas: query.select_as_cta,
  limitingFactor: query.limiting_factor,
  progress: query.progress,
  rows: query.rows,
  schema: query.schema,
  sql: query.sql,
  sqlEditorId: query.sql_editor_id,
  state: query.status,
  tab: query.tab_name,
  startDttm: Number(query.start_time),
  endDttm: Number(query.end_time),
  tempTable: query.tmp_table_name || '',
  trackingUrl: query.tracking_url,
  resultsKey: query.results_key,
  userId: query.user.id,
  cached: false,
  extra: {
    progress: null,
  },
  isDataPreview: false,
  user: query.user,
});

const queryHistoryApi = api.injectEndpoints({
  endpoints: builder => ({
    editorQueries: builder.query<QueryResult, EditorQueriesParams>({
      providesTags: ['EditorQueries'],
      query: ({ editorId, pageIndex = 0, pageSize = 25 }) => ({
        method: 'GET',
        endpoint: `/api/v1/query/`,
        urlParams: {
          keys: ['none'],
          columns: [
            'id',
            'client_id',
            'changed_on',
            'database.id',
            'database.database_name',
            'executed_sql',
            'error_message',
            'limit',
            'limiting_factor',
            'progress',
            'rows',
            'select_as_cta',
            'schema',
            'sql',
            'sql_editor_id',
            'status',
            'tab_name',
            'user.first_name',
            'user.id',
            'user.last_name',
            'start_time',
            'end_time',
            'tmp_table_name',
            'tmp_schema_name',
            'tracking_url',
            'results_key',
          ],
          order_column: 'start_time',
          order_direction: 'desc',
          page: pageIndex,
          page_size: pageSize,
          filters: [
            {
              col: 'sql_editor_id',
              opr: 'eq',
              value: editorId,
            },
          ],
        },
        headers: { 'Content-Type': 'application/json' },
        transformResponse: ({ json }: JsonResponse) => ({
          ...json,
          result: json.result.map(mapQueryResponse),
        }),
      }),
      serializeQueryArgs: ({ queryArgs: { editorId } }) => ({ editorId }),
      // Refetch when the page arg changes
      forceRefetch({ currentArg, previousArg }) {
        return currentArg !== previousArg;
      },
      merge: (currentCache, newItems) => {
        currentCache.result.push(...newItems.result);
      },
    }),
  }),
});

export const { useEditorQueriesQuery } = queryHistoryApi;
