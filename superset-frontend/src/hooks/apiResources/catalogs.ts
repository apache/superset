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
  onError?: () => void;
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
  const [trigger] = useLazyCatalogsQuery();
  const result = useCatalogsQuery(
    { dbId, forceRefresh: false },
    {
      skip: !dbId,
    },
  );

  const handleOnSuccess = useEffectEvent(
    (data: CatalogOption[], isRefetched: boolean) => {
      onSuccess?.(data, isRefetched);
    },
  );

  const handleOnError = useEffectEvent(() => {
    onError?.();
  });

  const resolver = useEffectEvent(() =>
    result.currentData ? undefined : trigger({ dbId, forceRefresh: false }),
  );

  const refetch = useCallback(() => {
    if (dbId) {
      trigger({ dbId, forceRefresh: true }).then(
        ({ isSuccess, isError, data }) => {
          if (isSuccess) {
            handleOnSuccess(data || EMPTY_CATALOGS, true);
          }
          if (isError) {
            handleOnError();
          }
        },
      );
    }
  }, [dbId, handleOnError, handleOnSuccess, trigger]);

  useEffect(() => {
    if (dbId) {
      resolver()?.then(({ isSuccess, isError, data }) => {
        if (isSuccess) {
          handleOnSuccess(data || EMPTY_CATALOGS, false);
        }
        if (isError) {
          handleOnError();
        }
      });
    }
  }, [dbId, result, handleOnSuccess, handleOnError, resolver]);

  return {
    ...result,
    refetch,
  };
}
