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
import { GenericDataType } from '@apache-superset/core/common';
import {
  ChartProps,
  DataRecordFilters,
  QueryFormData,
  QueryFormMetric,
  SetDataMaskHook,
  JsonObject,
} from '@superset-ui/core';

export interface TreeLevel {
  key: string;
  name: string;
  name_plural?: string;
  id_column: string;
  parent_column?: string;
  time_column?: string;
  columns: string[];
  detail_fields: string[];
  sort?: [string, boolean];
  children_shown?: number;
  apply_date_filter?: boolean;
}

export interface TreeMirrors {
  tree_columns: string[];
  tree_metrics: QueryFormMetric[];
  tree_orderby: [string, boolean][];
}

export type TreeTableFormData = QueryFormData & {
  levels?: TreeLevel[];
  tree_server_page_length?: number;
};

export type TreeTableChartProps = ChartProps<TreeTableFormData>;

export interface TreeTableOwnState {
  chartState?: JsonObject;
  currentPage?: number;
  pageSize?: number;
  sortBy?: { id: string; key: string; desc: boolean }[];
}

export interface TreeTableColumn {
  key: string;
  label: string;
  dataType: GenericDataType;
  formatter?: (value: unknown) => string;
}

export interface TreeTableTransformedProps {
  /** Dataset storage formats keyed by temporal link column name. */
  linkDateFormats?: ReadonlyMap<string, string>;
  onChartStateChange?: (chartState: JsonObject) => void;
  width: number;
  height: number;
  levels: TreeLevel[];
  data: Record<string, unknown>[];
  colnames: string[];
  coltypes: GenericDataType[];
  rowcount: number;
  columns: TreeTableColumn[];
  pageSize: number;
  currentPage: number;
  serverPageLength: number;
  ownState: TreeTableOwnState;
  setDataMask: SetDataMaskHook;
  emitCrossFilters: boolean;
  filters?: DataRecordFilters;
  sliceId: number;
  rawFormData: TreeTableFormData;
  verboseMap: Record<string, string>;
}

export interface TreeTableChildRequest {
  /** The index of the level being loaded (1 or more). */
  level: number;
  /** Each parent row's path, from level 1 down to the parent. */
  paths: string[][];
  linkDateFormats?: ReadonlyMap<string, string>;
  sort?: [string, boolean];
  offset?: number;
}

export interface ChildrenEntry {
  inRange?: boolean;
  status: 'loading' | 'loaded' | 'empty' | 'error';
  rows: Record<string, unknown>[];
  total: number;
  colnames: string[];
  coltypes: GenericDataType[];
  more?: 'loading' | 'error';
}

export type ChildSort = [string, boolean] | undefined;

export type AreaOrigin = 'user' | 'expand-all' | 'refresh';

export type AreaAction =
  | 'expand'
  | 'collapse'
  | 'retry'
  | 'load-more'
  | 'child-sort'
  | 'refresh'
  | 'expand-all';

/** The latest state of one open area, for status texts and announcements. */
export interface AreaState {
  path: string[];
  level: number;
  action: AreaAction;
  origin: AreaOrigin;
  state: 'loading' | 'loaded' | 'empty' | 'error' | 'detail';
  more?: 'loading' | 'error';
  loaded?: number;
  total?: number;
}

export interface ExpandedMarker {
  __treeTableExpanded: true;
  parentKey: string;
  parentIndex: number;
  /** The open row's path, from level 1 down to the row. */
  path: string[];
}
