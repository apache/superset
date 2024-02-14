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
import { useCallback, useEffect, useRef } from 'react';
import useEffectEvent from 'src/hooks/useEffectEvent';
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

export const {
  useLazySchemasQuery,
  useSchemasQuery,
  endpoints: schemaEndpoints,
  util: schemaApiUtil,
} = schemaApi;

export const EMPTY_SCHEMAS = [] as SchemaOption[];

export function useSchemas(options: Params) {
  const isMountedRef = useRef(false);
  const { dbId, onSuccess, onError } = options || {};
  const [trigger] = useLazySchemasQuery();
  const result = useSchemasQuery(
    { dbId, forceRefresh: false },
    {
      skip: !dbId,
    },
  );

  const handleOnSuccess = useEffectEvent(
    (data: SchemaOption[], isRefetched: boolean) => {
      onSuccess?.(data, isRefetched);
    },
  );

  const handleOnError = useEffectEvent(() => {
    onError?.();
  });

  const refetch = useCallback(() => {
    if (dbId) {
      trigger({ dbId, forceRefresh: true }).then(
        ({ isSuccess, isError, data }) => {
          if (isSuccess) {
            handleOnSuccess(data || EMPTY_SCHEMAS, true);
          }
          if (isError) {
            handleOnError();
          }
        },
      );
    }
  }, [dbId, handleOnError, handleOnSuccess, trigger]);

  useEffect(() => {
    if (isMountedRef.current) {
      const { requestId, isSuccess, isError, isFetching, data, originalArgs } =
        result;
      if (!originalArgs?.forceRefresh && requestId && !isFetching) {
        if (isSuccess) {
          handleOnSuccess(data || EMPTY_SCHEMAS, false);
        }
        if (isError) {
          handleOnError();
        }
      }
    } else {
      isMountedRef.current = true;
    }
  }, [result, handleOnSuccess, handleOnError]);

  return {
    ...result,
    refetch,
  };
}
