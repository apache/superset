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

import buildQuery from '../../src/plugin/buildQuery';

describe('PivotTableChart buildQuery', () => {
  const formData = {
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
  };

  it('should build groupby with series in form data', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.columns).toEqual(['col1', 'col2', 'row1', 'row2']);
  });
});
