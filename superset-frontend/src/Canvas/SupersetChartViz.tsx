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

import { CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  getClientErrorObject,
  SupersetClient,
  SuperChart,
  type QueryData,
} from '@superset-ui/core';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import { t } from '@apache-superset/core/translation';
import { CdlFilter, VizNode } from './types';
import { resolveVars } from './resolve';
import { useActiveFilters, useUiState, useVariables } from './runtime';

interface ChartMeta {
  vizType: string;
  formData: Record<string, unknown>;
  datasourceId?: number;
}

const parseJson = (value: unknown): Record<string, unknown> | undefined => {
  if (typeof value === 'string' && value.trim()) {
    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return undefined;
    }
  }
  return (value as Record<string, unknown>) || undefined;
};

/** SupersetClient rejects with a Response, not an Error — unwrap it. */
const describeError = async (err: unknown): Promise<string> => {
  try {
    const obj = await getClientErrorObject(
      err as Parameters<typeof getClientErrorObject>[0],
    );
    return obj.error || obj.message || JSON.stringify(obj).slice(0, 200);
  } catch {
    return err instanceof Error ? err.message : String(err);
  }
};

/**
 * The governed head of the Viz union: renders an existing saved Superset chart
 * with its own viz plugin and form_data. Data goes through the same
 * getChartDataRequest the dashboard uses, so the plugin's buildQuery (and the
 * legacy API fallback) apply. Canvas filters are passed as `extra_form_data`,
 * exactly how native dashboard filters reach a chart.
 */
export function SupersetChartViz({
  node,
  style,
}: {
  node: VizNode;
  style?: CSSProperties;
}) {
  const { chartId } = node;
  const { vars } = useVariables();
  const { refreshNonce } = useUiState();
  const [meta, setMeta] = useState<ChartMeta | undefined>();
  const [queriesData, setQueriesData] = useState<QueryData[] | undefined>();
  const [error, setError] = useState<string | undefined>();

  // 1. Load the saved chart's viz type and form_data.
  useEffect(() => {
    if (!chartId) {
      return undefined;
    }
    let live = true;
    setError(undefined);
    SupersetClient.get({ endpoint: `/api/v1/chart/${chartId}` })
      .then(({ json }) => {
        if (!live) return;
        const { result } = json as unknown as {
          result: Record<string, unknown>;
        };
        // Prefer the API's form_data (already normalised); fall back to params.
        const base =
          parseJson(result.form_data) ?? parseJson(result.params) ?? {};
        const vizType = String(result.viz_type ?? base.viz_type ?? '');
        // A saved chart's params.datasource can be stale (example charts ship
        // with the wrong id). Slice.form_data overrides it server-side with the
        // authoritative datasource_id, so do the same here.
        const datasourceId = result.datasource_id;
        const datasourceType = String(result.datasource_type ?? 'table');
        const datasource =
          datasourceId != null
            ? `${datasourceId}__${datasourceType}`
            : base.datasource;
        setMeta({
          vizType,
          formData: {
            ...base,
            datasource,
            viz_type: vizType,
            slice_id: chartId,
          },
          datasourceId: Number(datasourceId ?? NaN),
        });
      })
      .catch(async err => {
        const message = await describeError(err);
        if (live) setError(message);
      });
    return () => {
      live = false;
    };
  }, [chartId]);

  // Canvas-global filters for this chart's dataset, plus node-level ones.
  const activeFilters = useActiveFilters(meta?.datasourceId ?? -1);
  const extraFilters = useMemo<CdlFilter[]>(
    () => [...activeFilters, ...resolveVars(node.filters ?? [], vars)],
    [activeFilters, node.filters, vars],
  );
  const filterKey = JSON.stringify(extraFilters);

  // 2. Fetch data through the standard chart-data path.
  useEffect(() => {
    if (!meta) {
      return undefined;
    }
    let live = true;
    const formData = extraFilters.length
      ? {
          ...meta.formData,
          extra_form_data: {
            ...((meta.formData.extra_form_data as Record<string, unknown>) ??
              {}),
            filters: extraFilters.map(f => ({
              col: f.col,
              op: f.op,
              val: f.val,
            })),
          },
        }
      : meta.formData;

    getChartDataRequest({ formData, resultFormat: 'json', resultType: 'full' })
      .then(({ json }) => {
        if (live) setQueriesData(json.result);
      })
      .catch(async err => {
        const message = await describeError(err);
        if (live) setError(message);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, filterKey, refreshNonce]);

  if (!chartId) {
    return (
      <div data-test="canvas-superset-chart-error">
        {t('chartId is required')}
      </div>
    );
  }
  if (error) {
    return (
      <div data-test="canvas-superset-chart-error">
        {t('Chart error: %s', error)}
      </div>
    );
  }
  if (!meta || !queriesData) {
    return <div data-test="canvas-superset-chart-loading">{t('Loading…')}</div>;
  }

  return (
    <div
      data-test="canvas-superset-chart"
      style={{ width: '100%', height: 320, ...style }}
    >
      <SuperChart
        chartType={meta.vizType}
        formData={meta.formData}
        queriesData={queriesData}
        width="100%"
        height="100%"
      />
    </div>
  );
}
