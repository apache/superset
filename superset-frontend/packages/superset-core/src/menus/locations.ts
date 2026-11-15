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
 * Chart download menus that accept extension items. Each command receives a
 * {@link ChartDownloadContext}.
 */
export type ChartDownloadLocation =
  | 'explore.chart.download'
  | 'explore.chart.download.pivoted'
  | 'explore.standalone.download'
  | 'dashboard.chart.download'
  | 'dashboard.chart.download.pivoted'
  | 'chart.drillDetail.download'
  | 'chart.drillBy.download';

/**
 * Dashboard download menus that accept extension items. Each command receives
 * a {@link DashboardDownloadContext}.
 */
export type DashboardDownloadLocation = 'dashboard.download';

/** Request body for `POST /api/v1/chart/data`. */
export interface ChartDataRequest {
  datasource: { id: number; type: string };
  queries: object[];
  result_type: string;
  result_format: string;
  force?: boolean;
  form_data?: object;
}

/**
 * Argument passed to commands contributed to a {@link ChartDownloadLocation}.
 */
export interface ChartDownloadContext {
  /**
   * Resolves to the chart-data request the CSV export would send, with
   * `result_format: 'json'`. Evaluated when called, so invoke it from the
   * command rather than ahead of time.
   */
  getPayload: () => Promise<ChartDataRequest>;
  /** ID of the saved chart the data comes from; absent for an unsaved chart. */
  chartId?: number;
  /** Display name of the chart. */
  chartName: string;
  /** Whether the current user may download this chart's data. */
  canDownload: boolean;
}

/**
 * Argument passed to commands contributed to a {@link DashboardDownloadLocation}.
 */
export interface DashboardDownloadContext {
  /** Numeric id of the dashboard. */
  dashboardId: number;
  /** Title of the dashboard. */
  dashboardTitle: string;
  /** Currently applied native filters, keyed by filter id. */
  activeDataMask: Record<
    string,
    {
      extraFormData: object;
      filterState: { value?: unknown; label?: string };
    }
  >;
  /** Whether the current user may download this dashboard's data. */
  canDownload: boolean;
}
