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
import buildQuery from '../../src/BoxPlot/buildQuery';
import { BoxPlotQueryFormData } from '../../src/BoxPlot/types';

describe('BoxPlot buildQuery', () => {
  const formData: BoxPlotQueryFormData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1Y',
    columns: [],
    metrics: ['foo'],
    groupby: ['bar'],
    whiskerOptions: 'Tukey',
    yAxisFormat: 'SMART_NUMBER',
    viz_type: 'my_chart',
  };

  it('should build timeseries when columns is empty', () => {
    const queryContext = buildQuery(formData);
    const [query] = queryContext.queries;
    expect(query.is_timeseries).toEqual(true);
    expect(query.metrics).toEqual(['foo']);
    expect(query.columns).toEqual(['bar']);
  });

  it('should build non-timeseries query object when columns is defined', () => {
    const queryContext = buildQuery({ ...formData, columns: ['qwerty'] });
    const [query] = queryContext.queries;
    expect(query.is_timeseries).toEqual(false);
    expect(query.metrics).toEqual(['foo']);
    expect(query.columns).toEqual(['qwerty', 'bar']);
  });
});
