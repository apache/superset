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
  AppSection,
  ChartProps,
  ensureIsArray,
  QueryMode,
} from '@superset-ui/core';
import { UniverChartProps, UniverQueryFormData } from '../types';
import { PIVOT_MODE } from './controls/shared';

function keyColumns(formData: UniverQueryFormData): number | undefined {
  if (formData.query_mode === PIVOT_MODE) {
    return ensureIsArray(formData.univer_pivot_rows).length;
  }
  if (formData.query_mode === QueryMode.Raw) return undefined;
  return ensureIsArray(formData.groupby).length || undefined;
}

export default function transformProps(
  chartProps: ChartProps,
): UniverChartProps {
  const { width, height, queriesData, hooks, appSection, datasource } =
    chartProps;
  const formData = chartProps.rawFormData as UniverQueryFormData;
  const { data = [], colnames = [], coltypes = [] } = queriesData[0] ?? {};

  return {
    width,
    height,
    data,
    colnames,
    coltypes,
    labels: datasource?.verboseMap ?? {},
    editable: appSection === AppSection.Explore,
    savedState: formData.univer_workbook ?? null,
    liveData: formData.univer_live_data ?? true,
    showHeaders: formData.univer_show_headers ?? false,
    setControlValue: hooks?.setControlValue,
    pivotRows:
      formData.query_mode === PIVOT_MODE
        ? ensureIsArray(formData.univer_pivot_rows).length
        : undefined,
    keyColumns: keyColumns(formData),
    rowGrouping:
      !!formData.univer_row_grouping && formData.query_mode !== QueryMode.Raw,
  };
}
