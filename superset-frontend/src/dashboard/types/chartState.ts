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

export interface AgGridColumnState {
  colId: string;
  width?: number;
  hide?: boolean;
  pinned?: 'left' | 'right' | null;
  sort?: 'asc' | 'desc' | null;
  sortIndex?: number;
  aggFunc?: string;
}

export interface AgGridSortModel {
  colId: string;
  sort: 'asc' | 'desc';
  sortIndex?: number;
}

export interface AgGridFilterModel {
  [colId: string]: {
    filterType: string;
    type?: string;
    filter?: any;
    condition1?: any;
    condition2?: any;
    operator?: string;
  };
}

export interface AgGridChartState {
  columnState: AgGridColumnState[];
  sortModel: AgGridSortModel[];
  filterModel: AgGridFilterModel;
  columnOrder?: string[];
  pageSize?: number;
  currentPage?: number;
}

export interface ChartState {
  chartId: number;
  vizType: string;
  state: AgGridChartState;
  lastModified?: number;
}

export interface DashboardChartStates {
  [chartId: string]: ChartState;
}
