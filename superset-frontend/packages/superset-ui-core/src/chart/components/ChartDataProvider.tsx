/*
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

import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import {
  SupersetClientInterface,
  RequestConfig,
  QueryFormData,
  Datasource,
} from '../..';
import ChartClient, { SliceIdAndOrFormData } from '../clients/ChartClient';
import { QueryData } from '../types/QueryResponse';

interface Payload {
  formData: Partial<QueryFormData>;
  queriesData: QueryData[];
  datasource?: Datasource;
}

export interface ProvidedProps {
  payload?: Payload;
  error?: Error;
  loading?: boolean;
}

export type ChartDataProviderProps =
  /** User can pass either one or both of sliceId or formData */
  SliceIdAndOrFormData & {
    /** Child function called with ProvidedProps */
    children: (provided: ProvidedProps) => ReactNode;
    /** Superset client which is used to fetch data. It should already be configured and initialized. */
    client?: SupersetClientInterface;
    /** Will fetch and include datasource metadata for SliceIdAndOrFormData in the payload. */
    loadDatasource?: boolean;
    /** Callback when an error occurs. Enables wrapping the Provider in an ErrorBoundary. */
    onError?: (error: ProvidedProps['error']) => void;
    /** Callback when data is loaded. */
    onLoaded?: (payload: ProvidedProps['payload']) => void;
    /** Hook to override the formData request config. */
    formDataRequestOptions?: Partial<RequestConfig>;
    /** Hook to override the datasource request config. */
    datasourceRequestOptions?: Partial<RequestConfig>;
    /** Hook to override the queriesData request config. */
    queryRequestOptions?: Partial<RequestConfig>;
  };

export type ChartDataProviderState = {
  status: 'uninitialized' | 'loading' | 'error' | 'loaded';
  payload?: ProvidedProps['payload'];
  error?: ProvidedProps['error'];
};

function ChartDataProvider({
  children,
  client,
  formData,
  sliceId,
  loadDatasource,
  onError,
  onLoaded,
  formDataRequestOptions,
  datasourceRequestOptions,
  queryRequestOptions,
}: ChartDataProviderProps) {
  const [state, setState] = useState<ChartDataProviderState>({
    status: 'uninitialized',
  });

  const chartClient = useMemo(() => new ChartClient({ client }), [client]);

  const extractSliceIdAndFormData = useCallback(
    (): SliceIdAndOrFormData =>
      formData ? { formData } : { sliceId: sliceId as number },
    [formData, sliceId],
  );

  const handleReceiveData = useCallback(
    (payload?: Payload) => {
      if (onLoaded) onLoaded(payload);
      setState({ payload, status: 'loaded' });
    },
    [onLoaded],
  );

  const handleError = useCallback(
    (error: ProvidedProps['error']) => {
      if (onError) onError(error);
      setState({ error, status: 'error' });
    },
    [onError],
  );

  const handleFetchData = useCallback(() => {
    setState({ status: 'loading' });
    try {
      chartClient
        .loadFormData(extractSliceIdAndFormData(), formDataRequestOptions)
        .then(loadedFormData =>
          Promise.all([
            loadDatasource
              ? chartClient.loadDatasource(
                  loadedFormData.datasource,
                  datasourceRequestOptions,
                )
              : Promise.resolve(undefined),
            chartClient.loadQueryData(loadedFormData, queryRequestOptions),
          ]).then(
            ([datasource, queriesData]) =>
              ({
                datasource,
                formData: loadedFormData,
                queriesData,
              }) as Payload,
          ),
        )
        .then(handleReceiveData)
        .catch(handleError);
    } catch (error) {
      handleError(error as Error);
    }
  }, [
    chartClient,
    extractSliceIdAndFormData,
    formDataRequestOptions,
    loadDatasource,
    datasourceRequestOptions,
    queryRequestOptions,
    handleReceiveData,
    handleError,
  ]);

  // Fetch data on mount and when formData or sliceId changes
  useEffect(() => {
    handleFetchData();
  }, [formData, sliceId, handleFetchData]);

  const { status, payload, error } = state;

  switch (status) {
    case 'loading':
      return children({ loading: true });
    case 'loaded':
      return children({ payload });
    case 'error':
      return children({ error });
    case 'uninitialized':
    default:
      return null;
  }
}

export default ChartDataProvider;
