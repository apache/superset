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
import { useCallback, useMemo, useEffect, useRef } from 'react';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { toQueryString } from 'src/utils/urlUtils';
import { api, JsonResponse } from './queryApi';

import { useSchemas } from './schemas';

export interface SavedContextStatus {
    build_time: string;
    status: string;
    size?: number;
    message?: string;
}

export interface LlmContextStatus {
  context?: SavedContextStatus;
  status: 'waiting' | 'building'
}

export type FetchLlmContextStatusQueryParams = {
  dbId?: string | number;
  onSuccess?: (data: Data, isRefetched: boolean) => void;
  onError?: (error: Response) => void;
};

const llmContextApi = api.injectEndpoints({
  endpoints: builder => ({
    contextStatus: builder.query<LlmContextStatus, FetchLlmContextStatusQueryParams>({
      providesTags: ['LlmContextStatus'],
      query: ({ dbId }) => ({
        endpoint: `api/v1/sqllab/db_context_status/`,
        urlParams: { pk: dbId },
      }),
      serializeQueryArgs: ({ queryArgs: { pk } }) => ({ pk }),
    }),
  }),
});

export const {
  useContextStatusQuery,
  endpoints: llmEndpoints,
} = llmContextApi;

export function useLlmContextStatus(options: FetchLlmContextStatusQueryParams) {
  const { dbId, onSuccess, onError } = options || {};

  const result = useContextStatusQuery(
    { dbId },
    { pollingInterval: 5000 },
  );

  const handleOnSuccess = useEffectEvent((data: Data, isRefetched: boolean) => {
    onSuccess?.(data, isRefetched);
  });

  const handleOnError = useEffectEvent((error: Response) => {
    onError?.(error);
  });

  useEffect(() => {
    const {
      requestId,
      isSuccess,
      isError,
      isFetching,
      currentData,
      error,
      originalArgs,
    } = result;
    if (requestId && !isFetching) {
      if (isSuccess && currentData) {
        handleOnSuccess(currentData.json, false);
      }
      if (isError) {
        handleOnError(error as Response);
      }
    }
  }, [result, handleOnSuccess, handleOnError]);

  return {
    ...result,
  };
}
