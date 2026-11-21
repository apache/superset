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

/**
 * @fileoverview Host side of the `charts` namespace.
 *
 * Everything an extension is spared lives here: the dataset's metadata, the
 * query pipeline, and `SuperChart`. The component's one job is to turn "this
 * form data" into "this chart", and to be honest about the states in between.
 */

import { useContext, useEffect, useRef, useState } from 'react';
import { ReactReduxContext } from 'react-redux';
import {
  getClientErrorObject,
  QueryData,
  QueryFormData,
  SuperChart,
  SupersetClient,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import type { charts as chartsApi } from '@apache-superset/core';
import { Loading } from '@superset-ui/core/components';
import { requestChartDataResolved } from 'src/components/Chart/chartAction';
import type { Dataset } from 'src/components/Chart/types';

type AssetChartProps = chartsApi.AssetChartProps;

type DatasetWithKey = Dataset & { id?: number; type?: string };

/** The form data's `datasource` is `"<id>__<type>"`; anything else is none. */
const datasourceKey = (datasource: unknown): string | undefined =>
  typeof datasource === 'string' && datasource.includes('__')
    ? datasource
    : undefined;

const fetchDatasourceMetadata = async (
  datasourceId: number,
  datasourceType: string,
): Promise<Dataset> => {
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/explore/?datasource_id=${datasourceId}&datasource_type=${encodeURIComponent(datasourceType)}`,
  });
  return (json as { result: { dataset: Dataset } }).result.dataset;
};

/**
 * The dataset an open Explore session already holds, if there is one.
 *
 * Read from the store only to save a round trip, and only if there is a store
 * and an explore slice in it: this component also lives on pages that have
 * neither, where there is simply nothing to reuse.
 */
const liveDatasourceIn = (
  store: { getState: () => unknown } | undefined,
): DatasetWithKey | undefined =>
  (store?.getState() as { explore?: { datasource?: unknown } } | undefined)
    ?.explore?.datasource as DatasetWithKey | undefined;

/**
 * Draws a chart from form data. See `charts.AssetChart` in
 * `@apache-superset/core` for the contract.
 */
export default function AssetChart({
  formData,
  height = '100%',
  width = '100%',
}: AssetChartProps) {
  const chartFormData = formData as QueryFormData;
  // Read lazily, when a query starts, rather than subscribed to: a
  // re-hydration of the session's datasource must not restart a chart that is
  // already being drawn.
  const store = useContext(ReactReduxContext)?.store;
  const storeRef = useRef(store);
  useEffect(() => {
    storeRef.current = store;
  }, [store]);

  const [queriesData, setQueriesData] = useState<QueryData[] | null>(null);
  const [datasource, setDatasource] = useState<Dataset | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const vizType = chartFormData?.viz_type;
  const wantedDatasource = datasourceKey(chartFormData?.datasource);

  useEffect(() => {
    fetchIdRef.current += 1;
    const fetchId = fetchIdRef.current;
    // Abort the chart-data wait rather than only dropping its result: an
    // async query keeps polling and holds its tasks open otherwise.
    const controller = new AbortController();
    setError(null);
    setQueriesData(null);
    setDatasource(undefined);

    // Nothing to draw, so nothing to ask. Querying a form data that names no
    // chart would spend a request to learn what is already known.
    if (!vizType) {
      setIsLoading(false);
      return undefined;
    }
    setIsLoading(true);

    const load = async () => {
      const live = liveDatasourceIn(storeRef.current);
      const liveKey =
        live?.id != null && live?.type ? `${live.id}__${live.type}` : undefined;
      let meta: Dataset | undefined = live;
      if (wantedDatasource && wantedDatasource !== liveKey) {
        // The form data is on a dataset other than the one the page holds,
        // so the page's metadata would label the chart with the wrong
        // columns.
        const [rawId, rawType] = wantedDatasource.split('__');
        try {
          meta = await fetchDatasourceMetadata(Number(rawId), rawType);
        } catch {
          if (fetchId === fetchIdRef.current) {
            setError(
              t(
                'The dataset this chart is built on is not available, so the chart cannot be shown.',
              ),
            );
          }
          return;
        }
      }
      const result = await requestChartDataResolved(
        { formData: chartFormData },
        controller.signal,
      );
      if (fetchId !== fetchIdRef.current) {
        return;
      }
      setQueriesData(result);
      setDatasource(meta);
    };

    load()
      .catch(async response => {
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        const { error: clientError, message } = await getClientErrorObject(
          response as Parameters<typeof getClientErrorObject>[0],
        );
        // The query's own message is kept rather than replaced with a
        // generic failure: it is what says why the chart will not draw.
        setError(
          clientError || message || t('The chart could not be loaded.'),
        );
      })
      .finally(() => {
        if (fetchId === fetchIdRef.current) {
          setIsLoading(false);
        }
      });

    return () => {
      fetchIdRef.current += 1;
      controller.abort();
    };
  }, [chartFormData, vizType, wantedDatasource]);

  return (
    <div
      data-test="asset-chart"
      aria-busy={isLoading}
      style={{ height, width, display: 'flex', flexDirection: 'column' }}
    >
      {!vizType && (
        <Alert
          type="warning"
          closable={false}
          data-test="asset-chart-empty"
        >
          {t(
            'There is no chart to draw: the form data does not name a chart type.',
          )}
        </Alert>
      )}
      {vizType && isLoading && <Loading />}
      {vizType && !isLoading && error && (
        <Alert
          type="error"
          closable={false}
          data-test="asset-chart-error"
        >
          {error}
        </Alert>
      )}
      {vizType && !isLoading && !error && queriesData && (
        <div style={{ flex: 1, minHeight: 0 }}>
          {/* SuperChart's own error boundary stays, so a plugin that throws
              on these settings degrades to a contained error instead of
              taking the page down with it. */}
          <SuperChart
            chartType={vizType}
            enableNoResults
            datasource={datasource}
            formData={chartFormData}
            queriesData={queriesData}
            height="100%"
            width="100%"
          />
        </div>
      )}
    </div>
  );
}
