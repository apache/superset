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
import { isEqual } from 'lodash-es';
import { TableChartProps } from '../types';

const getDescriptions = (props: TableChartProps) => {
  const colnames = props.queriesData?.[0]?.colnames || [];
  const columns = props.rawDatasource?.columns || [];
  const metrics = props.rawDatasource?.metrics || [];

  return colnames.map((key: string) => {
    // Internal names of metrics expressed as percentages have a "%" prefix,
    // however, their storage locations are defined in rawDatasource.metrics using the original names.
    const metricLookupKey = key.startsWith('%') ? key.slice(1) : key;
    return (
      columns.find((item: { column_name: string }) => item.column_name === key)
        ?.description ??
      metrics.find(
        (item: { metric_name: string }) => item.metric_name === metricLookupKey,
      )?.description
    );
  });
};

export default function isEqualColumns(
  propsA: TableChartProps[],
  propsB: TableChartProps[],
) {
  const a = propsA[0];
  const b = propsB[0];

  const descA = getDescriptions(a);
  const descB = getDescriptions(b);

  // Every field below is read with optional chaining because this comparator
  // also runs against partial/mock props in tests; production TableChartProps
  // always has these populated.
  const checks = {
    // These three are plain, serializable per-column config maps. Superset's
    // core datasource pipeline can rebuild them with a new object reference
    // on renders that don't actually change any formatting, so compare by
    // value here - otherwise an incidental new reference looks like a real
    // change and forces a full AG Grid column/row rebuild downstream.
    columnFormats: isEqual(
      a.datasource?.columnFormats,
      b.datasource?.columnFormats,
    ),
    currencyFormats: isEqual(
      a.datasource?.currencyFormats,
      b.datasource?.currencyFormats,
    ),
    verboseMap: isEqual(a.datasource?.verboseMap, b.datasource?.verboseMap),
    currencyCodeColumn:
      a.datasource?.currencyCodeColumn === b.datasource?.currencyCodeColumn,
    detectedCurrency:
      a.queriesData?.[0]?.detected_currency ===
      b.queriesData?.[0]?.detected_currency,
    tableTimestampFormat:
      a.formData?.tableTimestampFormat === b.formData?.tableTimestampFormat,
    timeGrainSqla: a.formData?.timeGrainSqla === b.formData?.timeGrainSqla,
    columnConfig:
      JSON.stringify(a.formData?.columnConfig || null) ===
      JSON.stringify(b.formData?.columnConfig || null),
    metrics: isEqualArray(a.formData?.metrics, b.formData?.metrics),
    colnames: isEqualArray(
      a.queriesData?.[0]?.colnames,
      b.queriesData?.[0]?.colnames,
    ),
    coltypes: isEqualArray(
      a.queriesData?.[0]?.coltypes,
      b.queriesData?.[0]?.coltypes,
    ),
    extraFilters:
      JSON.stringify(a.formData?.extraFilters || null) ===
      JSON.stringify(b.formData?.extraFilters || null),
    extraFormData:
      JSON.stringify(a.formData?.extraFormData || null) ===
      JSON.stringify(b.formData?.extraFormData || null),
    rawColumnConfig:
      JSON.stringify(a.rawFormData?.column_config || null) ===
      JSON.stringify(b.rawFormData?.column_config || null),
    descriptions: JSON.stringify(descA) === JSON.stringify(descB),
  };
  return Object.values(checks).every(Boolean);
}
