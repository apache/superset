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
import { useCallback, useEffect } from 'react';
import { api, JsonResponse } from './queryApi';

export type SchemaOption = {
  value: string;
  label: string;
  title: string;
};

export type FetchSchemasQueryParams = {
  dbId?: string | number;
  forceRefresh: boolean;
  onSuccess?: (data: SchemaOption[], isRefetched: boolean) => void;
  onError?: () => void;
};

type Params = Omit<FetchSchemasQueryParams, 'forceRefresh'>;

const schemaApi = api.injectEndpoints({
  endpoints: builder => ({
    schemas: builder.query<SchemaOption[], FetchSchemasQueryParams>({
      providesTags: [{ type: 'Schemas', id: 'LIST' }],
      query: ({ dbId, forceRefresh }) => ({
        endpoint: `/api/v1/database/${dbId}/schemas/`,
        // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
        urlParams: {
          force: forceRefresh,
        },
        transformResponse: ({ json }: JsonResponse) =>
          json.result.map((value: string) => ({
            value,
            label: value,
            title: value,
          })),
      }),
      serializeQueryArgs: ({ queryArgs: { dbId } }) => ({
        dbId,
      }),
    }),
  }),
});

export const { useLazySchemasQuery, useSchemasQuery } = schemaApi;

const EMPTY_SCHEMAS = [] as SchemaOption[];

export function useSchemas(options: Params) {
  const { dbId, onSuccess, onError } = options || {};
  const [trigger, refetchResult] = useLazySchemasQuery();
  const result = useSchemasQuery(
    { dbId, forceRefresh: false },
    {
      skip: !dbId,
    },
  );

  const refetch = useCallback(() => {
    if (dbId) {
      trigger({ dbId, forceRefresh: true }).then(
        ({ isSuccess, isError, data }) => {
          if (isSuccess) {
            onSuccess?.(data || EMPTY_SCHEMAS, true);
          }
          if (isError) {
            onError?.();
          }
        },
      );
    }
  }, [dbId]);

  useEffect(() => {
    const { requestId, isSuccess, isError, isFetching, data, originalArgs } =
      result;
    if (!originalArgs?.forceRefresh && requestId && !isFetching) {
      if (isSuccess) {
        onSuccess?.(data || EMPTY_SCHEMAS, false);
      }
      if (isError) {
        onError?.();
      }
    }
  }, [result]);

  return {
    ...(refetchResult.isUninitialized ? result : refetchResult),
    refetch,
  };
}
