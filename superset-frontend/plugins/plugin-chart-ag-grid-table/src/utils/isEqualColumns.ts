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
import { isEqualArray } from '@superset-ui/core';
import { TableChartProps } from '../types';

export default function isEqualColumns(
  propsA: TableChartProps[],
  propsB: TableChartProps[],
) {
  const a = propsA[0];
  const b = propsB[0];
  return (
    a.datasource.columnFormats === b.datasource.columnFormats &&
    a.datasource.currencyFormats === b.datasource.currencyFormats &&
    a.datasource.verboseMap === b.datasource.verboseMap &&
    a.formData.tableTimestampFormat === b.formData.tableTimestampFormat &&
    a.formData.timeGrainSqla === b.formData.timeGrainSqla &&
    JSON.stringify(a.formData.columnConfig || null) ===
      JSON.stringify(b.formData.columnConfig || null) &&
    isEqualArray(a.formData.metrics, b.formData.metrics) &&
    isEqualArray(a.queriesData?.[0]?.colnames, b.queriesData?.[0]?.colnames) &&
    isEqualArray(a.queriesData?.[0]?.coltypes, b.queriesData?.[0]?.coltypes) &&
    JSON.stringify(a.formData.extraFilters || null) ===
      JSON.stringify(b.formData.extraFilters || null) &&
    JSON.stringify(a.formData.extraFormData || null) ===
      JSON.stringify(b.formData.extraFormData || null) &&
    JSON.stringify(a.rawFormData.column_config || null) ===
      JSON.stringify(b.rawFormData.column_config || null)
  );
}
