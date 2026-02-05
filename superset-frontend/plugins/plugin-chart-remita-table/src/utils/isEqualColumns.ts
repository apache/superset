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
// Note: This comparator is used by memoizeOne for processColumns.
// It must only compare schema-affecting properties, never data rows.
import { TableChartProps } from '../types';

export default function isEqualColumns(
  propsA: TableChartProps[],
  propsB: TableChartProps[],
) {
  const a = propsA[0];
  const b = propsB[0];
  return (
    // datasource-level formatters and verbose names
    (a as any)?.datasource?.columnFormats === (b as any)?.datasource?.columnFormats &&
    (a as any)?.datasource?.currencyFormats === (b as any)?.datasource?.currencyFormats &&
    (a as any)?.datasource?.verboseMap === (b as any)?.datasource?.verboseMap &&
    // time formatting/grain that affects temporal column formatters
    (a as any)?.rawFormData?.table_timestamp_format ===
      (b as any)?.rawFormData?.table_timestamp_format &&
    (a as any)?.formData?.timeGrainSqla === (b as any)?.formData?.timeGrainSqla &&
    // humanize headers toggles label derivation
    (a as any)?.rawFormData?.humanize_headers ===
      (b as any)?.rawFormData?.humanize_headers &&
    // per-column config (number/time/currency formats)
    JSON.stringify(((a as any)?.rawFormData?.column_config) || null) ===
      JSON.stringify(((b as any)?.rawFormData?.column_config) || null) &&
    // metric membership toggles metric/percent flags on columns
    isEqualArray((a as any)?.formData?.metrics, (b as any)?.formData?.metrics) &&
    // schema from query response (names and types only)
    isEqualArray(a.queriesData?.[0]?.colnames, b.queriesData?.[0]?.colnames) &&
    isEqualArray(a.queriesData?.[0]?.coltypes, b.queriesData?.[0]?.coltypes)
  );
}
