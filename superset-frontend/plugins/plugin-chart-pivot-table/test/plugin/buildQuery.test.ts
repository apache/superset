/*
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

import { TimeGranularity } from '@superset-ui/core';
import * as supersetCoreModule from '@superset-ui/core';
import buildQuery from '../../src/plugin/buildQuery';
import { PivotTableQueryFormData } from '../../src/types';

describe('PivotTableChart buildQuery', () => {
  const formData: PivotTableQueryFormData = {
    groupbyRows: ['row1', 'row2'],
    groupbyColumns: ['col1', 'col2'],
    metrics: ['metric1', 'metric2'],
    tableRenderer: 'Table With Subtotal',
    colOrder: 'key_a_to_z',
    rowOrder: 'key_a_to_z',
    aggregateFunction: 'Sum',
    transposePivot: true,
    rowSubtotalPosition: true,
    colSubtotalPosition: true,
    colTotals: true,
    rowTotals: true,
    valueFormat: 'SMART_NUMBER',
    datasource: '5__table',
    viz_type: 'my_chart',
    width: 800,
    height: 600,
    combineMetric: false,
    verboseMap: {},
    columnFormats: {},
    metricColorFormatters: [],
    dateFormatters: {},
    setDataMask: () => {},
    legacy_order_by: 'count',
    order_desc: true,
    margin: 0,
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['col1', 'col2', 'row1', 'row2']);
  });

  it('should work with old charts after GENERIC_CHART_AXES is enabled', () => {
    Object.defineProperty(supersetCoreModule, 'hasGenericChartAxes', {
      value: true,
    });
    const modifiedFormData = {
      ...formData,
      time_grain_sqla: TimeGranularity.MONTH,
      granularity_sqla: 'col1',
    };
    const queryContext = buildQuery(modifiedFormData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual([
      {
        timeGrain: 'P1M',
        columnType: 'BASE_AXIS',
        sqlExpression: 'col1',
        label: 'col1',
        expressionType: 'SQL',
      },
      'col2',
      'row1',
      'row2',
    ]);
  });
});
