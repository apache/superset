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
import { ColumnState } from '@ag-grid-enterprise/all-modules';
import {
  ChartDataResponseResult,
  ChartProps,
  HandlerFunction,
  QueryFormData,
  SetDataMaskHook,
  supersetTheme,
  TimeseriesDataRecord,
} from '@superset-ui/core';

export type CccsGridQueryFormData = QueryFormData & {
  headerText?: string;
  setDataMask?: SetDataMaskHook;
  selectedValues?: Record<number, string>;
  emitFilter: boolean;
  include_search: boolean;
  page_length: number;
  enable_grouping: boolean;
  column_state: ColumnState[];
};

export interface CccsGridStylesProps {
  height: number;
  width: number;
  headerFontSize?: keyof typeof supersetTheme.typography.sizes;
  boldText?: boolean;
}

// @ts-ignore
export const DEFAULT_FORM_DATA: CccsGridQueryFormData = {
  result_type: 'post_processed',
  viz_type: 'cccs_grid',
};

export interface CccsGridChartDataResponseResult
  extends ChartDataResponseResult {
  agGridLicenseKey: string;
}

export class CccsGridChartProps extends ChartProps {
  declare formData: CccsGridQueryFormData;

  declare queriesData: CccsGridChartDataResponseResult[];
}

export interface CccsGridTransformedProps extends CccsGridStylesProps {
  formData: CccsGridQueryFormData;
  setDataMask: SetDataMaskHook;
  setControlValue: HandlerFunction;
  selectedValues: Record<number, string>;
  emitFilter: boolean;
  data: TimeseriesDataRecord[];
  columnDefs: any;
  rowData: any;
  tooltipShowDelay: any;
  frameworkComponents: any;
  modules: any;
  defaultColDef: any;
  rowSelection: any;
  filters: any;
  include_search: boolean;
  page_length: number;
  enable_grouping: boolean;
  column_state: ColumnState[];
  // add typing here for the props you pass in from transformProps.ts!
  agGridLicenseKey: string;
}

export type EventHandlers = Record<string, { (props: any): void }>;
