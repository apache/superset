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
import {
  QueryData,
  QueryFormData,
  AnnotationData,
  AdhocMetric,
} from '@superset-ui/core';
import { ColumnMeta, DatasourceMeta } from '@superset-ui/chart-controls';
import { DatabaseObject } from 'src/views/CRUD/types';

export { Slice, Chart } from 'src/types/Chart';

export type ChartStatus =
  | 'loading'
  | 'rendered'
  | 'failed'
  | 'stopped'
  | 'success';

export interface ChartState {
  id: number;
  annotationData?: AnnotationData;
  annotationError?: Record<string, string>;
  annotationQuery?: Record<string, AbortController>;
  chartAlert: string | null;
  chartStatus: ChartStatus | null;
  chartStackTrace?: string | null;
  chartUpdateEndTime: number | null;
  chartUpdateStartTime: number;
  lastRendered: number;
  latestQueryFormData: Partial<QueryFormData>;
  sliceFormData: QueryFormData | null;
  queryController: AbortController | null;
  queriesResponse: QueryData | null;
  triggerQuery: boolean;
}

export type OptionSortType = Partial<
  ColumnMeta & AdhocMetric & { saved_metric_name: string }
>;

export type Datasource = DatasourceMeta & {
  database?: DatabaseObject;
  datasource?: string;
  schema?: string;
  is_sqllab_view?: boolean;
};
