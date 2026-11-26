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

import { useEffect, useRef, useState } from 'react';
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
 * Draws a chart from form data. See `charts.AssetChart` in
 * `@apache-superset/core` for the contract.
 */
export default function AssetChart({
  formData,
  height = '100%',
  width = '100%',
}: AssetChartProps) {
  const [queriesData, setQueriesData] = useState<QueryData[] | null>(null);
  const [datasource, setDatasource] = useState<Dataset | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchIdRef = useRef(0);

  const vizType = formData?.viz_type;
  const wantedDatasource = datasourceKey(formData?.datasource);

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
      // Looked up for the datasource the form data names, and for no other.
      // Reusing whatever dataset the page happened to hold would label a
      // chart that names none with an unrelated dataset's columns, and
      // reading it meant reaching into Explore's store shape from here.
      //
      // Alongside the query rather than before it: the metadata only labels
      // the chart, so making the query wait on it would cost a round trip
      // before any data is asked for. It also settles its own failure, so
      // the pair below rejects only when the query does.
      const wantedMetadata = async (): Promise<Dataset | undefined> => {
        if (!wantedDatasource) {
          return undefined;
        }
        const [rawId, rawType] = wantedDatasource.split('__');
        try {
          return await fetchDatasourceMetadata(Number(rawId), rawType);
        } catch {
          // Whether the user may read this dataset's data is the query's
          // call -- it also honours chart and dashboard grants this lookup
          // does not -- and its refusal is the message the user gets.
          return undefined;
        }
      };

      const [meta, result] = await Promise.all([
        wantedMetadata(),
        requestChartDataResolved(
          // `QueryFormData` requires `viz_type` and `datasource`; the
          // published type leaves both optional because a caller may
          // legitimately omit them. `viz_type` is established by the guard
          // above, and the query is the right place for a missing
          // `datasource` to be refused, so this is the one narrowing that
          // stays.
          { formData: formData as QueryFormData },
          controller.signal,
        ),
      ]);
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
        // Reading the error body is async too; the chart may have moved on.
        if (fetchId !== fetchIdRef.current) {
          return;
        }
        // The query's own message is kept rather than replaced with a
        // generic failure: it is what says why the chart will not draw.
        setError(clientError || message || t('The chart could not be loaded.'));
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
  }, [formData, vizType, wantedDatasource]);

  return (
    <div
      data-test="asset-chart"
      aria-busy={isLoading}
      style={{ height, width, display: 'flex', flexDirection: 'column' }}
    >
      {!vizType && (
        <Alert type="warning" closable={false} data-test="asset-chart-empty">
          {t(
            'There is no chart to draw: the form data does not name a chart type.',
          )}
        </Alert>
      )}
      {vizType && isLoading && <Loading />}
      {vizType && !isLoading && error && (
        <Alert type="error" closable={false} data-test="asset-chart-error">
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
            formData={formData as QueryFormData}
            queriesData={queriesData}
            height="100%"
            width="100%"
          />
        </div>
      )}
    </div>
  );
}
