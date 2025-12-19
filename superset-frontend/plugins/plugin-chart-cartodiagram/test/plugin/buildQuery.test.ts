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
import { getChartBuildQueryRegistry } from '@superset-ui/core';
import buildQuery from '../../src/plugin/buildQuery';

describe('CartodiagramPlugin buildQuery', () => {
  const selectedChartParams = {
    extra_form_data: {},
    groupby: [],
  };

  const selectedChart = {
    viz_type: 'pie',
    params: JSON.stringify(selectedChartParams),
  };

  const formData = {
    datasource: '5__table',
    granularity_sqla: 'ds',
    series: 'foo',
    viz_type: 'my_chart',
    selected_chart: JSON.stringify(selectedChart),
    geom_column: 'geom',
  };

  let chartQueryBuilderMock: jest.MockedFunction<any>;
  beforeEach(() => {
    chartQueryBuilderMock = jest.fn();

    const registry = getChartBuildQueryRegistry();
    registry.registerValue('pie', chartQueryBuilderMock);
  });

  afterEach(() => {
    // remove registered buildQuery
    const registry = getChartBuildQueryRegistry();
    registry.clear();
  });

  it('should call the buildQuery function of the referenced chart', () => {
    buildQuery(formData);
    expect(chartQueryBuilderMock.mock.calls).toHaveLength(1);
  });

  it('should build groupby with geom in form data', () => {
    const expectedParams = { ...selectedChartParams, groupby: ['geom'] };

    buildQuery(formData);
    expect(chartQueryBuilderMock.mock.calls[0][0]).toEqual(expectedParams);
  });
});
