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
import { api, JsonResponse } from './queryApi';

import { useSchemas } from './schemas';

export interface Table {
  label: string;
  value: string;
  type: string;
  extra?: {
    certification?: {
      certified_by: string;
      details: string;
    };
    warning_markdown?: string;
  };
}

type QueryResponse = {
  json: {
    count: number;
    result: Table[];
  };
  response: Response;
};

export type Data = {
  options: Table[];
  hasMore: boolean;
};

export type FetchTablesQueryParams = {
  dbId?: string | number;
  schema?: string;
  forceRefresh?: boolean;
  onSuccess?: (data: Data, isRefetched: boolean) => void;
  onError?: (error: Response) => void;
};

export type FetchTableMetadataQueryParams = {
  dbId: string | number;
  schema: string;
  table: string;
};

type ColumnKeyTypeType = 'pk' | 'fk' | 'index';
interface Column {
  name: string;
  keys?: { type: ColumnKeyTypeType }[];
  type: string;
}

export type TableMetaData = {
  name: string;
  partitions?: {
    partitionQuery: string;
    latest: object[];
  };
  metadata?: Record<string, string>;
  indexes?: object[];
  selectStar?: string;
  view?: string;
  columns: Column[];
};

type TableMetadataReponse = {
  json: TableMetaData;
  response: Response;
};

export type TableExtendedMetadata = Record<string, string>;

type Params = Omit<FetchTablesQueryParams, 'forceRefresh'>;

const tableApi = api.injectEndpoints({
  endpoints: builder => ({
    tables: builder.query<Data, FetchTablesQueryParams>({
      providesTags: ['Tables'],
      query: ({ dbId, schema, forceRefresh }) => ({
        endpoint: `/api/v1/database/${dbId ?? 'undefined'}/tables/`,
        // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
        urlParams: {
          force: forceRefresh,
          schema_name: schema ? encodeURIComponent(schema) : '',
        },
        transformResponse: ({ json }: QueryResponse) => ({
          options: json.result,
          hasMore: json.count > json.result.length,
        }),
      }),
      serializeQueryArgs: ({ queryArgs: { dbId, schema } }) => ({
        dbId,
        schema,
      }),
    }),
    tableMetadata: builder.query<TableMetaData, FetchTableMetadataQueryParams>({
      query: ({ dbId, schema, table }) => ({
        endpoint: `/api/v1/database/${dbId}/table/${encodeURIComponent(
          table,
        )}/${encodeURIComponent(schema)}/`,
        transformResponse: ({ json }: TableMetadataReponse) => json,
      }),
    }),
    tableExtendedMetadata: builder.query<
      TableExtendedMetadata,
      FetchTableMetadataQueryParams
    >({
      query: ({ dbId, schema, table }) => ({
        endpoint: `/api/v1/database/${dbId}/table_extra/${encodeURIComponent(
          table,
        )}/${encodeURIComponent(schema)}/`,
        transformResponse: ({ json }: JsonResponse) => json,
      }),
    }),
  }),
});

export const {
  useLazyTablesQuery,
  useTablesQuery,
  useTableMetadataQuery,
  useTableExtendedMetadataQuery,
  endpoints: tableEndpoints,
  util: tableApiUtil,
} = tableApi;

export function useTables(options: Params) {
  const isMountedRef = useRef(false);
  const { data: schemaOptions, isFetching } = useSchemas({
    dbId: options.dbId,
  });
  const schemaOptionsMap = useMemo(
    () => new Set(schemaOptions?.map(({ value }) => value)),
    [schemaOptions],
  );
  const { dbId, schema, onSuccess, onError } = options || {};

  const enabled = Boolean(
    dbId && schema && !isFetching && schemaOptionsMap.has(schema),
  );

  const result = useTablesQuery(
    { dbId, schema, forceRefresh: false },
    {
      skip: !enabled,
    },
  );
  const [trigger] = useLazyTablesQuery();

  const handleOnSuccess = useEffectEvent((data: Data, isRefetched: boolean) => {
    onSuccess?.(data, isRefetched);
  });

  const handleOnError = useEffectEvent((error: Response) => {
    onError?.(error);
  });

  const refetch = useCallback(() => {
    if (enabled) {
      trigger({ dbId, schema, forceRefresh: true }).then(
        ({ isSuccess, isError, data, error }) => {
          if (isSuccess && data) {
            handleOnSuccess(data, true);
          }
          if (isError) {
            handleOnError(error as Response);
          }
        },
      );
    }
  }, [dbId, schema, enabled, handleOnSuccess, handleOnError, trigger]);

  useEffect(() => {
    if (isMountedRef.current) {
      const {
        requestId,
        isSuccess,
        isError,
        isFetching,
        data,
        error,
        originalArgs,
      } = result;
      if (!originalArgs?.forceRefresh && requestId && !isFetching) {
        if (isSuccess && data) {
          handleOnSuccess(data, false);
        }
        if (isError) {
          handleOnError(error as Response);
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
