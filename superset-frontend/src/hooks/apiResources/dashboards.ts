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

import { Dashboard, Datasource, EmbeddedDashboard } from 'src/dashboard/types';
import { Chart } from 'src/types/Chart';
import { Currency } from '@superset-ui/core';
import { useApiV1Resource, useTransformedResource } from './apiResources';

const dashboardEndpoint = (idOrSlug: string | number, refreshKey?: number) =>
  refreshKey !== undefined && refreshKey > 0
    ? `/api/v1/dashboard/${idOrSlug}?__refresh=${refreshKey}`
    : `/api/v1/dashboard/${idOrSlug}`;

export const useDashboard = (idOrSlug: string | number, refreshKey?: number) =>
  useTransformedResource(
    useApiV1Resource<Dashboard>(dashboardEndpoint(idOrSlug, refreshKey)),
    dashboard => ({
      ...dashboard,
      // TODO: load these at the API level
      metadata:
        (dashboard.json_metadata && JSON.parse(dashboard.json_metadata)) || {},
      position_data:
        dashboard.position_json && JSON.parse(dashboard.position_json),
      owners: dashboard.owners || [],
    }),
  );

const dashboardChartsEndpoint = (
  idOrSlug: string | number,
  refreshKey?: number,
) =>
  refreshKey !== undefined && refreshKey > 0
    ? `/api/v1/dashboard/${idOrSlug}/charts?__refresh=${refreshKey}`
    : `/api/v1/dashboard/${idOrSlug}/charts`;

export const useDashboardCharts = (
  idOrSlug: string | number,
  refreshKey?: number,
) => useApiV1Resource<Chart[]>(dashboardChartsEndpoint(idOrSlug, refreshKey));

// gets the datasets for a dashboard
// important: this endpoint only returns the fields in the dataset
// that are necessary for rendering the given dashboard
export const useDashboardDatasets = (idOrSlug: string | number) =>
  useTransformedResource(
    useApiV1Resource<Datasource[]>(`/api/v1/dashboard/${idOrSlug}/datasets`),
    datasets =>
      datasets.map(dataset => ({
        ...dataset,
        currencyFormats: Object.fromEntries(
          (dataset.metrics ?? [])
            .filter(metric => !!metric.currency)
            .map((metric): [string, Currency] => [
              metric.metric_name,
              metric.currency!,
            ]),
        ),
      })),
  );

export const useEmbeddedDashboard = (idOrSlug: string | number) =>
  useApiV1Resource<EmbeddedDashboard>(`/api/v1/dashboard/${idOrSlug}/embedded`);
