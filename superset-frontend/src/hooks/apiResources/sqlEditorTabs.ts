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
import { pickBy } from 'lodash';
import { QueryEditor, LatestQueryEditorVersion } from 'src/SqlLab/types';
import { api, JsonResponse } from './queryApi';

export type EditorMutationParams = {
  queryEditor: QueryEditor;
  extra?: Record<string, any>;
};

const sqlEditorApi = api.injectEndpoints({
  endpoints: builder => ({
    updateSqlEditorTab: builder.mutation<JsonResponse, EditorMutationParams>({
      query: ({
        queryEditor: {
          version = LatestQueryEditorVersion,
          id,
          dbId,
          catalog,
          schema,
          queryLimit,
          sql,
          name,
          latestQueryId,
          hideLeftBar,
          templateParams,
          autorun,
          updatedAt,
        },
        extra,
      }) => ({
        method: 'PUT',
        endpoint: encodeURI(`/tabstateview/${id}`),
        postPayload: pickBy(
          {
            database_id: dbId,
            catalog,
            schema,
            sql,
            label: name,
            query_limit: queryLimit,
            latest_query_id: latestQueryId,
            template_params: templateParams,
            hide_left_bar: hideLeftBar,
            autorun,
            extra_json: JSON.stringify({ updatedAt, version, ...extra }),
          },
          value => value !== undefined,
        ),
      }),
    }),
    updateCurrentSqlEditorTab: builder.mutation<string, string>({
      query: queryEditorId => ({
        method: 'POST',
        endpoint: encodeURI(`/tabstateview/${queryEditorId}/activate`),
        transformResponse: () => queryEditorId,
      }),
    }),
    deleteSqlEditorTab: builder.mutation<void, string>({
      query: queryEditorId => ({
        method: 'DELETE',
        endpoint: encodeURI(`/tabstateview/${queryEditorId}`),
        transformResponse: () => queryEditorId,
      }),
    }),
  }),
});

export const {
  useUpdateSqlEditorTabMutation,
  useUpdateCurrentSqlEditorTabMutation,
  useDeleteSqlEditorTabMutation,
} = sqlEditorApi;
