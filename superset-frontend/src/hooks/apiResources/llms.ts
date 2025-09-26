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
import { useEffect, useRef, useReducer } from 'react';
import useEffectEvent from 'src/hooks/useEffectEvent';
import { api, JsonResponse } from './queryApi';

export interface SavedContextStatus {
  build_time: string;
  status: string;
  size?: number;
  message?: string;
}

export interface LlmContextStatus {
  context?: SavedContextStatus;
  error?: { build_time: string };
  status: 'waiting' | 'building';
}

export type FetchLlmContextStatusQueryParams = {
  dbId?: string | number | null;
  onSuccess?: (data: LlmContextStatus, isRefetched: boolean) => void;
  onError?: (error: Response) => void;
  skip?: boolean;
};

export interface LlmDefaults {
  [provider: string]: {
    models: {
      [modelName: string]: { name: string; input_token_limit: number };
    };
    instructions: string;
    name?: string; // Display name for custom providers
  };
}

export type LlmDefaultsParams = {
  dbId: number | null;
  onSuccess?: (data: LlmDefaults, isRefetched: boolean) => void;
  onError?: (error: Response) => void;
  skip?: boolean;
};

export interface CustomLlmProvider {
  id: number;
  name: string;
  endpoint_url: string;
  request_template: string;
  response_path: string;
  headers: string | null;
  models: string;
  system_instructions: string | null;
  timeout: number | null;
  enabled: boolean;
  created_on: string;
  changed_on: string;
}

export interface CustomLlmProviderForm {
  name: string;
  endpoint_url: string;
  request_template: string;
  response_path: string;
  headers?: string;
  models: string;
  system_instructions?: string;
  timeout?: number;
  enabled?: boolean;
}

const llmContextApi = api.injectEndpoints({
  endpoints: builder => ({
    contextStatus: builder.query<
      LlmContextStatus,
      FetchLlmContextStatusQueryParams
    >({
      providesTags: ['LlmContextStatus'],
      query: ({ dbId }) => ({
        endpoint: `api/v1/sqllab/db_context_status/`,
        urlParams: { pk: dbId },
        transformResponse: ({ json }: JsonResponse) => json,
      }),
    }),
    llmDefaults: builder.query<LlmDefaults, number>({
      providesTags: ['LlmDefaults'],
      query: dbId => ({
        endpoint: `api/v1/database/${dbId}/llm_defaults/`,
        transformResponse: ({ json }: JsonResponse) => json,
      }),
    }),
    customLlmProviders: builder.query<CustomLlmProvider[], void>({
      providesTags: ['CustomLlmProvider'],
      query: () => ({
        endpoint: 'api/v1/custom_llm_provider/',
        transformResponse: ({ json }: JsonResponse) => json.result,
      }),
    }),
    createCustomLlmProvider: builder.mutation<
      CustomLlmProvider,
      CustomLlmProviderForm
    >({
      invalidatesTags: ['CustomLlmProvider', 'LlmDefaults'],
      query: provider => ({
        endpoint: 'api/v1/custom_llm_provider/',
        method: 'POST',
        body: provider,
        transformResponse: ({ json }: JsonResponse) => json,
      }),
    }),
    updateCustomLlmProvider: builder.mutation<
      CustomLlmProvider,
      { id: number; provider: Partial<CustomLlmProviderForm> }
    >({
      invalidatesTags: ['CustomLlmProvider', 'LlmDefaults'],
      query: ({ id, provider }) => ({
        endpoint: `api/v1/custom_llm_provider/${id}`,
        method: 'PUT',
        body: provider,
        transformResponse: ({ json }: JsonResponse) => json,
      }),
    }),
    deleteCustomLlmProvider: builder.mutation<void, number>({
      invalidatesTags: ['CustomLlmProvider', 'LlmDefaults'],
      query: id => ({
        endpoint: `api/v1/custom_llm_provider/${id}`,
        method: 'DELETE',
      }),
    }),
    testCustomLlmProvider: builder.mutation<
      { status: string; message: string },
      Partial<CustomLlmProviderForm>
    >({
      query: provider => ({
        endpoint: 'api/v1/custom_llm_provider/test',
        method: 'POST',
        body: provider,
        transformResponse: ({ json }: JsonResponse) => json.result,
      }),
    }),
  }),
});

export const {
  useContextStatusQuery,
  useLlmDefaultsQuery,
  useCustomLlmProvidersQuery,
  useCreateCustomLlmProviderMutation,
  useUpdateCustomLlmProviderMutation,
  useDeleteCustomLlmProviderMutation,
  useTestCustomLlmProviderMutation,
  endpoints: llmEndpoints,
} = llmContextApi;

export function useLlmContextStatus(options: FetchLlmContextStatusQueryParams) {
  const { dbId, onSuccess, onError, skip } = options || {};

  const pollingInterval = useRef<number>(30000);
  const [, forceUpdate] = useReducer(x => x + 1, 0);

  const result = useContextStatusQuery(
    { dbId: dbId || undefined },
    {
      pollingInterval: pollingInterval.current,
      refetchOnMountOrArgChange: true,
      skip: skip || !dbId,
    },
  );

  // Adjust polling interval based on status
  useEffect(() => {
    const status = result?.data?.status;
    const desiredInterval = status === 'building' ? 5000 : 30000;
    if (pollingInterval.current !== desiredInterval) {
      pollingInterval.current = desiredInterval;
      forceUpdate();
    }
  }, [result?.data?.status]);

  const handleOnSuccess = useEffectEvent(
    (data: LlmContextStatus, isRefetched: boolean) => {
      onSuccess?.(data, isRefetched);
    },
  );

  const handleOnError = useEffectEvent((error: Response) => {
    onError?.(error);
  });

  useEffect(() => {
    const { requestId, isSuccess, isError, isFetching, currentData, error } =
      result;
    if (requestId && !isFetching) {
      if (isSuccess && currentData) {
        handleOnSuccess(currentData, false);
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

export function useLlmDefaults(options: LlmDefaultsParams) {
  const { dbId, onSuccess, onError, skip } = options || {};
  const result = useLlmDefaultsQuery(dbId || 0, {
    skip: skip || !dbId,
    refetchOnMountOrArgChange: true,
  });

  console.log('useLlmDefaults result:', result);

  const handleOnSuccess = useEffectEvent(
    (data: LlmDefaults, isRefetched: boolean) => {
      onSuccess?.(data, isRefetched);
    },
  );

  const handleOnError = useEffectEvent((error: Response) => {
    onError?.(error);
  });

  useEffect(() => {
    const { requestId, isSuccess, isError, isFetching, currentData, error } =
      result;
    if (requestId && !isFetching) {
      if (isSuccess && currentData) {
        handleOnSuccess(currentData, false);
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
