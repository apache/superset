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
import $ from 'jquery';
import '../../helpers/shim';
import Table from '../../../src/visualizations/Table/Table';
import transformProps from '../../../src/visualizations/Table/transformProps';

describe('table viz', () => {
  const div = '<div id="slice-container"></div>';
  const BASE_CHART_PROPS = {
    height: 100,
    datasource: {
      verboseMap: {},
    },
    filters: {},
    formData: {
      metrics: ['count'],
      timeseriesLimitMetric: null,
    },
    onAddFilter() {},
    payload: {
      data: {
        records: [
          { gender: 'boy', count: 39245 },
          { gender: 'girl', count: 36446 },
        ],
        columns: ['gender', 'count'],
      },
    },
  };

  const PAYLOAD2 = {
    data: {
      records: [
        { gender: 'boy', count: 39245, 'SUM(sum_boys)': 48133355 },
        { gender: 'girl', count: 36446, 'SUM(sum_boys)': 0 },
      ],
      columns: ['gender', 'count', 'SUM(sum_boys)'],
    },
  };

  let container;
  let $container;

  beforeEach(() => {
    $('body').html(div);
    container = document.getElementById('slice-container');
    $container = $(container);
  });

  it('renders into a container', () => {
    expect($container.children()).toHaveLength(0);
    Table(container, transformProps(BASE_CHART_PROPS));
    expect($container.children()).toHaveLength(1);
  });

  it('renders header and body datatables in container', () => {
    expect($container.find('.dataTable')).toHaveLength(0);
    Table(container, transformProps(BASE_CHART_PROPS));
    expect($container.find('.dataTable')).toHaveLength(2);

    const tableHeader = $container.find('.dataTable')[0];
    expect($(tableHeader).find('thead tr')).toHaveLength(1);
    expect($(tableHeader).find('th')).toHaveLength(2);

    const tableBody = $container.find('.dataTable')[1];
    expect($(tableBody).find('tbody tr')).toHaveLength(2);
    expect($(tableBody).find('th')).toHaveLength(2);
  });

  it('hides the sort by column', () => {
    const chartProps = {
      ...BASE_CHART_PROPS,
      formData: {
        ...BASE_CHART_PROPS.formData,
        timeseriesLimitMetric: {
          label: 'SUM(sum_boys)',
        },
      },
      payload: PAYLOAD2,
    };

    Table(container, transformProps(chartProps));
    const tableHeader = $container.find('.dataTable')[0];
    expect($(tableHeader).find('th')).toHaveLength(2);
  });

  it('works with empty list for sort by', () => {
    const chartProps = {
      ...BASE_CHART_PROPS,
      formData: {
        ...BASE_CHART_PROPS.formData,
        timeseriesLimitMetric: [],
      },
      payload: PAYLOAD2,
    };

    Table(container, transformProps(chartProps));
    const tableBody = $container.find('.dataTable')[1];
    expect($(tableBody).find('th')).toHaveLength(3);
  });
});
