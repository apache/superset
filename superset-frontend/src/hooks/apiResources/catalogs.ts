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

export type CatalogOption = {
  value: string;
  label: string;
  title: string;
};

export type FetchCatalogsQueryParams = {
  dbId?: string | number;
  forceRefresh: boolean;
  onSuccess?: (data: CatalogOption[], isRefetched: boolean) => void;
  onError?: (error: ClientErrorObject) => void;
};

type Params = Omit<FetchCatalogsQueryParams, 'forceRefresh'>;

const catalogApi = api.injectEndpoints({
  endpoints: builder => ({
    catalogs: builder.query<CatalogOption[], FetchCatalogsQueryParams>({
      providesTags: [{ type: 'Catalogs', id: 'LIST' }],
      query: ({ dbId, forceRefresh }) => ({
        endpoint: `/api/v1/database/${dbId}/catalogs/`,
        urlParams: {
          force: forceRefresh,
        },
        transformResponse: ({ json }: JsonResponse) =>
          json.result.sort().map((value: string) => ({
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
  useLazyCatalogsQuery,
  useCatalogsQuery,
  endpoints: catalogEndpoints,
  util: catalogApiUtil,
} = catalogApi;

export const EMPTY_CATALOGS = [] as CatalogOption[];

export function useCatalogs(options: Params) {
  const { dbId, onSuccess, onError } = options || {};
  const wasFetchingRef = useRef(false);
  const isRefreshingRef = useRef(false);
  const result = useCatalogsQuery(
    { dbId, forceRefresh: false },
    {
      skip: !dbId,
    },
  );
  const [trigger] = useLazyCatalogsQuery();

  const handleOnSuccess = useEffectEvent(
    (data: CatalogOption[], isRefetched: boolean) => {
      onSuccess?.(data, isRefetched);
    },
  );

  const handleOnError = useEffectEvent((error: ClientErrorObject) => {
    onError?.(error);
  });

  const refetch = useCallback(() => {
    if (dbId) {
      // Force a real server refresh. The success/error callbacks are fired by
      // the subscribed effect below (the single source of truth), which
      // observes the shared cache entry's isFetching transition. isRefreshingRef
      // flags that completion as a user-requested refresh (isRefetched=true).
      isRefreshingRef.current = true;
      trigger({ dbId, forceRefresh: true });
    }
  }, [dbId, trigger]);

  useEffect(() => {
    // Fire the success/error callbacks whenever the subscribed query finishes a
    // fetch, not just when data is loaded through the lazy `trigger` path. This
    // covers refetches driven by cache invalidation (e.g. after an OAuth2
    // redirect) so consumers holding local state such as an auth error banner
    // are notified. Keying off the isFetching true->false transition avoids
    // re-firing on cache-hit re-renders, which would spuriously re-run
    // auto-select logic in the selectors. isRefreshingRef (not the sticky
    // originalArgs.forceRefresh, which the shared cache entry never resets)
    // distinguishes a user-requested refresh from other fetches.
    const { isSuccess, isError, isFetching, currentData, error } = result;
    if (wasFetchingRef.current && !isFetching) {
      const isRefetched = isRefreshingRef.current;
      if (isSuccess && currentData) {
        handleOnSuccess(currentData, isRefetched);
      }
      if (isError) {
        handleOnError(error as ClientErrorObject);
      }
      isRefreshingRef.current = false;
    }
    wasFetchingRef.current = isFetching;
  }, [result, handleOnSuccess, handleOnError]);

  return {
    ...result,
    refetch,
  };
}
