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

import { useApiV1Resource } from './apiResources';

// Database entity type
export type DatabaseEntity = {
  id: number;
  database_name: string;
  backend: string;
};

// Dataset entity type
export type DatasetEntity = {
  id: number;
  name: string;
  schema: string | null;
  table_name: string;
  database_id: number;
  database_name: string;
  chart_ids?: number[];
};

// Chart entity type
export type ChartEntity = {
  id: number;
  slice_name: string;
  viz_type: string;
  dashboard_ids?: number[];
  dataset_id?: number;
};

// Dashboard entity type
export type DashboardEntity = {
  id: number;
  title: string;
  slug: string;
  chart_ids?: number[];
};

// Dataset lineage response type
export type DatasetLineage = {
  dataset: DatasetEntity;
  upstream: {
    database: DatabaseEntity;
  };
  downstream: {
    charts: {
      count: number;
      result: ChartEntity[];
    };
    dashboards: {
      count: number;
      result: DashboardEntity[];
    };
  };
};

// Chart lineage response type
export type ChartLineage = {
  chart: ChartEntity & {
    datasource_id: number;
    datasource_type: string;
  };
  upstream: {
    dataset: DatasetEntity;
    database: DatabaseEntity;
  };
  downstream: {
    dashboards: {
      count: number;
      result: DashboardEntity[];
    };
  };
};

// Dashboard lineage response type
export type DashboardLineage = {
  dashboard: DashboardEntity & {
    published: boolean;
  };
  upstream: {
    charts: {
      count: number;
      result: ChartEntity[];
    };
    datasets: {
      count: number;
      result: DatasetEntity[];
    };
    databases: {
      count: number;
      result: DatabaseEntity[];
    };
  };
  downstream: null;
};

/**
 * Hook to fetch lineage data for a dataset
 * @param idOrUuid Dataset ID or UUID
 */
export const useDatasetLineage = (idOrUuid: string | number) =>
  useApiV1Resource<DatasetLineage>(`/api/v1/dataset/${idOrUuid}/lineage`);

/**
 * Hook to fetch lineage data for a chart
 * @param idOrUuid Chart ID or UUID
 */
export const useChartLineage = (idOrUuid: string | number) =>
  useApiV1Resource<ChartLineage>(`/api/v1/chart/${idOrUuid}/lineage`);

/**
 * Hook to fetch lineage data for a dashboard
 * @param idOrSlug Dashboard ID or slug
 */
export const useDashboardLineage = (idOrSlug: string | number) =>
  useApiV1Resource<DashboardLineage>(`/api/v1/dashboard/${idOrSlug}/lineage`);
