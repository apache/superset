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
  catalog?: string | null;
  schema?: string;
  forceRefresh?: boolean;
  onSuccess?: (data: Data, isRefetched: boolean) => void;
  onError?: (error: Response) => void;
};

export type FetchTableMetadataQueryParams = {
  dbId: string | number;
  catalog?: string | null;
  schema: string;
  table: string;
};

type ColumnKeyTypeType = 'pk' | 'fk' | 'index';
export interface Column {
  name: string;
  keys?: { type: ColumnKeyTypeType }[];
  type: string;
  comment?: string;
  longType: string;
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
  comment?: string;
};

type TableMetadataResponse = {
  json: TableMetaData;
  response: Response;
};

export type TableExtendedMetadata = Record<string, string>;

type Params = Omit<FetchTablesQueryParams, 'forceRefresh'>;

const tableApi = api.injectEndpoints({
  endpoints: builder => ({
    tables: builder.query<Data, FetchTablesQueryParams>({
      providesTags: ['Tables'],
      query: ({ dbId, catalog, schema, forceRefresh }) => ({
        endpoint: `/api/v1/database/${dbId ?? 'undefined'}/tables/`,
        // TODO: Would be nice to add pagination in a follow-up. Needs endpoint changes.
        urlParams: {
          force: forceRefresh,
          schema_name: schema ? encodeURIComponent(schema) : '',
          ...(catalog && { catalog_name: catalog }),
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
      providesTags: result =>
        result
          ? [
              { type: 'TableMetadatas', id: result.name },
              { type: 'TableMetadatas', id: 'LIST' },
            ]
          : [{ type: 'TableMetadatas', id: 'LIST' }],
      query: ({ dbId, catalog, schema, table }) => ({
        endpoint: `/api/v1/database/${dbId}/table_metadata/${toQueryString({
          name: table,
          catalog,
          schema,
        })}`,
        transformResponse: ({ json }: TableMetadataResponse) => json,
      }),
    }),
    tableExtendedMetadata: builder.query<
      TableExtendedMetadata,
      FetchTableMetadataQueryParams
    >({
      query: ({ dbId, catalog, schema, table }) => ({
        endpoint: `/api/v1/database/${dbId}/table_metadata/extra/${toQueryString(
          { name: table, catalog, schema },
        )}`,
        transformResponse: ({ json }: JsonResponse) => json,
      }),
      providesTags: (result, error, { table }) => [
        { type: 'TableMetadatas', id: table },
      ],
    }),
  }),
});

export const {
  useLazyTablesQuery,
  useTablesQuery,
  useLazyTableMetadataQuery,
  useLazyTableExtendedMetadataQuery,
  useTableMetadataQuery,
  useTableExtendedMetadataQuery,
  endpoints: tableEndpoints,
  util: tableApiUtil,
} = tableApi;

export function useTables(options: Params) {
  const { dbId, catalog, schema, onSuccess, onError } = options || {};
  const isMountedRef = useRef(false);
  const { currentData: schemaOptions, isFetching } = useSchemas({
    dbId,
    catalog: catalog || undefined,
  });
  const schemaOptionsMap = useMemo(
    () => new Set(schemaOptions?.map(({ value }) => value)),
    [schemaOptions],
  );

  const enabled = Boolean(
    dbId && schema && !isFetching && schemaOptionsMap.has(schema),
  );

  const result = useTablesQuery(
    { dbId, catalog, schema, forceRefresh: false },
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
      trigger({ dbId, catalog, schema, forceRefresh: true }).then(
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
  }, [dbId, catalog, schema, enabled, handleOnSuccess, handleOnError, trigger]);

  useEffect(() => {
    if (isMountedRef.current) {
      const {
        requestId,
        isSuccess,
        isError,
        isFetching,
        currentData,
        error,
        originalArgs,
      } = result;
      if (!originalArgs?.forceRefresh && requestId && !isFetching) {
        if (isSuccess && currentData) {
          handleOnSuccess(currentData, false);
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
