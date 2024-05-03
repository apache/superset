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

export type FetchValidationQueryParams = {
  dbId?: string | number;
  schema?: string;
  sql: string;
  templateParams?: string;
};

type ValidationResult = {
  end_column: number | null;
  line_number: number | null;
  message: string | null;
  start_column: number | null;
};

const queryValidationApi = api.injectEndpoints({
  endpoints: builder => ({
    queryValidations: builder.query<
      ValidationResult[],
      FetchValidationQueryParams
    >({
      providesTags: ['QueryValidations'],
      query: ({ dbId, schema, sql, templateParams }) => {
        let template_params = templateParams;
        try {
          template_params = JSON.parse(templateParams || '');
        } catch (e) {
          template_params = undefined;
        }
        const postPayload = {
          schema,
          sql,
          ...(template_params && { template_params }),
        };
        return {
          method: 'post',
          endpoint: `/api/v1/database/${dbId}/validate_sql/`,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(postPayload),
          transformResponse: ({ json }: JsonResponse) => json.result,
        };
      },
    }),
  }),
});

export const { useQueryValidationsQuery } = queryValidationApi;
