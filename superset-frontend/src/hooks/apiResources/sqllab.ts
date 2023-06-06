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
import { api, JsonResponse } from './queryApi';

export type FetchTranslateQueryParams = {
  sql?: string;
  readDialect?: string;
  writeDialect: string;
};

const sqlLabApi = api.injectEndpoints({
  endpoints: builder => ({
    translate: builder.query<string, FetchTranslateQueryParams>({
      providesTags: ['Translate'],
      query: ({ sql, readDialect, writeDialect }) => ({
        method: 'POST',
        endpoint: `/api/v1/sqllab/translate/`,
        jsonPayload: {
          sql,
          read_dialect: readDialect,
          write_dialect: writeDialect,
        },
      }),
      transformResponse: ({ json }: JsonResponse) => json.result,
    }),
  }),
});

export const { useTranslateQuery } = sqlLabApi;
