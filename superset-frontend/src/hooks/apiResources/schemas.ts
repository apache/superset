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
import { ClientErrorObject } from '@superset-ui/core';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { api, JsonResponse } from './queryApi';

export type SchemaOption = {
  value: string;
  label: string;
  title: string;
};

export type FetchSchemasQueryParams = {
  dbId?: string | number;
  catalog?: string;
  forceRefresh: boolean;
  onSuccess?: (data: SchemaOption[], isRefetched: boolean) => void;
  onError?: (error: ClientErrorObject) => void;
};

type Params = Omit<FetchSchemasQueryParams, 'forceRefresh'>;

const schemaApi = api.injectEndpoints({
  endpoints: builder => ({
    schemas: builder.query<SchemaOption[], FetchSchemasQueryParams>({
      providesTags: [{ type: 'Schemas', id: 'LIST' }],
      query: ({ dbId, catalog, forceRefresh }) => ({
        endpoint: `/api/v1/database/${dbId}/schemas/`,
        // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
        urlParams: {
          force: forceRefresh,
          ...(catalog !== undefined && { catalog }),
        },
        transformResponse: ({ json }: JsonResponse) =>
          json.result.sort().map((value: string) => ({
            value,
            label: value,
            title: value,
          })),
      }),
      serializeQueryArgs: ({ queryArgs: { dbId, catalog } }) => ({
        dbId,
        catalog,
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
  const { dbId, catalog, onSuccess, onError } = options || {};
  const wasFetchingRef = useRef(false);
  const result = useSchemasQuery(
    { dbId, catalog: catalog || undefined, forceRefresh: false },
    {
      skip: !dbId,
    },
  );
  const [trigger] = useLazySchemasQuery();

  const handleOnSuccess = useEffectEvent(
    (data: SchemaOption[], isRefetched: boolean) => {
      onSuccess?.(data, isRefetched);
    },
  );

  const handleOnError = useEffectEvent((error: ClientErrorObject) => {
    onError?.(error);
  });

  const refetch = useCallback(() => {
    if (dbId) {
      trigger({ dbId, catalog, forceRefresh: true }).then(
        ({ isSuccess, isError, data, error }) => {
          if (isSuccess) {
            handleOnSuccess(data || EMPTY_SCHEMAS, true);
          }
          if (isError) {
            handleOnError(error as ClientErrorObject);
          }
        },
      );
    }
  }, [dbId, catalog, handleOnSuccess, handleOnError, trigger]);

  useEffect(() => {
    // Fire the success/error callbacks whenever the subscribed query finishes a
    // fetch, not just when data is loaded through the lazy `trigger` path. This
    // covers refetches driven by cache invalidation (e.g. after an OAuth2
    // redirect) so consumers holding local state such as an auth error banner
    // are notified. Keying off the isFetching true->false transition avoids
    // re-firing on cache-hit re-renders, which would spuriously re-run
    // auto-select logic in the selectors.
    const { isSuccess, isError, isFetching, currentData, error, originalArgs } =
      result;
    if (wasFetchingRef.current && !isFetching && !originalArgs?.forceRefresh) {
      if (isSuccess && currentData) {
        handleOnSuccess(currentData, false);
      }
      if (isError) {
        handleOnError(error as ClientErrorObject);
      }
    }
    wasFetchingRef.current = isFetching;
  }, [result, handleOnSuccess, handleOnError]);

  return {
    ...result,
    refetch,
  };
}
