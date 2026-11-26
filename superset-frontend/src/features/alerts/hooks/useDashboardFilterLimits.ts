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
import { useCallback, useEffect, useState } from 'react';
import {
  FeatureFlag,
  isFeatureEnabled,
  SupersetClient,
  type TimeRangeLimits,
} from '@superset-ui/core';
import {
  dashboardFilterLimits,
  type DashboardLimitsPayload,
  hasLimits,
  LIMIT_REQUEST_OPTIONS,
} from 'src/utils/timeRangeLimits';
import reportRenderedChartIds, {
  layoutChartIds,
} from '../reportRenderedCharts';

type ChartDatasource = { id: number; form_data?: { datasource?: unknown } };

/** The limits of one Time Range filter of the report. */
export type ReportFilterLimits =
  | { status: 'off' }
  | { status: 'loading' }
  | { status: 'unavailable' }
  | { status: 'on'; limits: TimeRangeLimits };

type Layout = {
  charts: Map<number, ChartDatasource>;
  positionJson: string | null;
};

type Loaded =
  | { status: 'loading' }
  | { status: 'failed' }
  | {
      status: 'loaded';
      payload: DashboardLimitsPayload;
      layout: Layout | null;
    };

const OFF: ReportFilterLimits = { status: 'off' };
const UNAVAILABLE: ReportFilterLimits = { status: 'unavailable' };
// A chart's dataset, as the dashboard's `hasNoRule` reads it: only a table
// has a dataset policy.
const DATASOURCE = /^(\d+)__(\w+)$/;

class IncompleteResponse extends Error {}

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const getResult = (endpoint: string) =>
  SupersetClient.get({ endpoint, ...LIMIT_REQUEST_OPTIONS }).then(
    ({ json }): unknown => (isObject(json) ? json.result : undefined),
  );

function limitsPayload(result: unknown): DashboardLimitsPayload {
  if (
    !isObject(result) ||
    !('global' in result) ||
    !('dashboard' in result) ||
    !Array.isArray(result.datasets)
  ) {
    throw new IncompleteResponse();
  }
  return result as DashboardLimitsPayload;
}

function chartsOf(result: unknown) {
  if (!Array.isArray(result)) {
    throw new IncompleteResponse();
  }
  return new Map(
    result
      .filter(
        (chart): chart is ChartDatasource =>
          isObject(chart) && Number.isInteger(chart.id),
      )
      .map(chart => [chart.id, chart]),
  );
}

function positionJsonOf(result: unknown) {
  const positionJson = isObject(result) ? result.position_json : undefined;
  if (positionJson !== null && typeof positionJson !== 'string') {
    throw new IncompleteResponse();
  }
  return positionJson;
}

async function loadLimits(dashboardId: number) {
  const payload = limitsPayload(
    await getResult(`/api/v1/dashboard/${dashboardId}/time_range_limits/`),
  );
  if (!payload.datasets.length) {
    return { payload, layout: null };
  }
  const [charts, dashboard] = await Promise.all([
    getResult(`/api/v1/dashboard/${dashboardId}/charts`),
    getResult(`/api/v1/dashboard/${dashboardId}`),
  ]);
  return {
    payload,
    layout: {
      charts: chartsOf(charts),
      positionJson: positionJsonOf(dashboard),
    },
  };
}

/**
 * The dataset ids of the charts in `chartsInScope` the report renders, or
 * `null` when one of them can't be mapped to its datasource.
 */
function renderedDatasets(
  layout: Layout,
  chartsInScope: number[] | undefined,
  dashboardState: unknown,
  tabsEnabled: boolean,
) {
  const scoped = chartsInScope ?? [
    ...new Set([
      ...layoutChartIds(layout.positionJson),
      ...layout.charts.keys(),
    ]),
  ];
  const datasetIds = new Set<number | null>();
  for (const chartId of reportRenderedChartIds(
    layout.positionJson,
    scoped,
    dashboardState,
    tabsEnabled,
  )) {
    const datasource = layout.charts.get(chartId)?.form_data?.datasource;
    const match =
      typeof datasource === 'string' ? DATASOURCE.exec(datasource) : null;
    if (!match) {
      return null;
    }
    if (match[2] === 'table') {
      datasetIds.add(Number(match[1]));
    }
  }
  return datasetIds;
}

/**
 * The limits of a report's dashboard Time Range filters (flag on only), as the
 * dashboard's own filter bar checks them: the global and dashboard policies
 * and the policies of the datasets of the charts in a filter's scope that the
 * report renders. Limits that can't be loaded or come back incomplete, a
 * dataset policy that failed and a rendered chart in scope without a known
 * datasource make the filter `unavailable`; `retry` loads them again. With
 * no `dashboardId` (no dashboard, or not a report) every filter is `off`.
 */
export default function useDashboardFilterLimits(
  dashboardId: number | undefined,
  dashboardState: unknown,
  tabsEnabled: boolean,
) {
  const enabled =
    !!dashboardId && isFeatureEnabled(FeatureFlag.TimeRangeLimits);
  const [loaded, setLoaded] = useState<Loaded & { dashboardId?: number }>({
    status: 'loading',
  });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled || !dashboardId) {
      return undefined;
    }
    let active = true;
    setLoaded({ status: 'loading', dashboardId });
    loadLimits(dashboardId)
      .then(({ payload, layout }) => {
        if (active) {
          setLoaded({ status: 'loaded', payload, layout, dashboardId });
        }
      })
      .catch(() => {
        if (active) {
          setLoaded({ status: 'failed', dashboardId });
        }
      });
    return () => {
      active = false;
    };
  }, [enabled, dashboardId, attempt]);

  const retry = useCallback(() => setAttempt(current => current + 1), []);

  const limitsFor = useCallback(
    (chartsInScope: number[] | undefined): ReportFilterLimits => {
      if (!enabled) {
        return OFF;
      }
      if (loaded.dashboardId !== dashboardId || loaded.status === 'loading') {
        return { status: 'loading' };
      }
      if (loaded.status === 'failed') {
        return UNAVAILABLE;
      }
      const { payload, layout } = loaded;
      let datasetIds: Set<number | null> | null = null;
      if (layout) {
        datasetIds = renderedDatasets(
          layout,
          chartsInScope,
          dashboardState,
          tabsEnabled,
        );
        if (
          !datasetIds ||
          payload.datasets.some(
            dataset => dataset.error && datasetIds?.has(dataset.id),
          )
        ) {
          return UNAVAILABLE;
        }
      }
      const limits = dashboardFilterLimits(payload, dashboardId, datasetIds);
      return hasLimits(limits.levels) ? { status: 'on', limits } : OFF;
    },
    [enabled, loaded, dashboardId, dashboardState, tabsEnabled],
  );

  return { limitsFor, retry };
}
