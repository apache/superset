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
import { createSelector } from '@reduxjs/toolkit';
import { shallowEqual } from 'react-redux';
import { isEqual } from 'lodash-es';
import { EMPTY_FILTER_SQL_EXPRESSION } from 'src/utils/common';
import {
  Clauses,
  ExpressionTypes,
} from 'src/explore/components/controls/FilterControl/types';
import {
  DataMaskStateWithId,
  DatasourceType,
  PartialFilters,
} from '@superset-ui/core';

export type ChartDatasources = Record<string, string | undefined>;

/** Share the projection across charts and preserve identity on status updates. */
export const selectChartDatasources: (state: {
  charts: Record<string, { form_data?: { datasource?: string } }>;
}) => ChartDatasources = createSelector(
  [
    ({
      charts,
    }: {
      charts: Record<string, { form_data?: { datasource?: string } }>;
    }) => charts,
  ],
  (charts): ChartDatasources =>
    Object.fromEntries(
      Object.entries(charts).map(([id, chart]) => [
        id,
        chart.form_data?.datasource,
      ]),
    ),
  { memoizeOptions: { resultEqualityCheck: shallowEqual } },
);

/** Classify optional dashboard predicates; never certify semantic selections. */
export function getIgnoredSqlFilterIds(
  receiver: { datasource?: string; semantic_selection_version?: string },
  nativeFilters: PartialFilters,
  dataMask: DataMaskStateWithId,
  sourceDatasources: ChartDatasources = {},
): string[] {
  if (
    !receiver.datasource?.endsWith(`__${DatasourceType.SemanticView}`) ||
    !receiver.semantic_selection_version
  ) {
    return [];
  }
  return Object.keys(dataMask).filter(id => {
    const native = nativeFilters?.[id];
    const extra = dataMask[id]?.extraFormData;
    const predicateKey =
      native?.filterType === 'filter_select' &&
      isEqual(extra?.adhoc_filters, [
        {
          expressionType: ExpressionTypes.Sql,
          clause: Clauses.Where,
          sqlExpression: EMPTY_FILTER_SQL_EXPRESSION,
        },
      ])
        ? 'adhoc_filters'
        : 'filters';
    // Member overrides and customizations retain their identity validation.
    if (
      !extra?.[predicateKey]?.length ||
      Object.keys(extra).some(
        key => key !== predicateKey && key !== 'semantic_selection_sources',
      ) ||
      (native &&
        !['filter_select', 'filter_range'].includes(native.filterType ?? ''))
    ) {
      return false;
    }
    const target = native?.targets?.[0];
    // Native targets use table when datasourceType is omitted, like their query.
    const source = native
      ? target?.datasetId
        ? `${target.datasetId}__${target.datasourceType || DatasourceType.Table}`
        : undefined
      : sourceDatasources[id];
    return Boolean(
      source?.endsWith(`__${DatasourceType.Table}`) &&
      (extra.semantic_selection_sources ?? []).every(
        selection => selection.datasource === source,
      ),
    );
  });
}
