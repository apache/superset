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
describe('Visualization > Pivot Table', () => {
  const PIVOT_TABLE_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'pivot_table',
    slice_id: 61,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100+years+ago+:+now',
    metrics: ['sum__num'],
    adhoc_filters: [],
    groupby: ['name'],
    columns: ['state'],
    row_limit: 5000,
    pandas_aggfunc: 'sum',
    pivot_margins: true,
    number_format: '.3s',
    combine_metric: false,
  };

  const TEST_METRIC = {
    expressionType: 'SIMPLE',
    column: {
      id: 338,
      column_name: 'num_boys',
      expression: '',
      filterable: false,
      groupby: false,
      is_dttm: false,
      type: 'BIGINT',
      optionName: '_col_num_boys',
    },
    aggregate: 'SUM',
    hasCustomLabel: false,
    label: 'SUM(num_boys)',
    optionName: 'metric_gvpdjt0v2qf_6hkf56o012',
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'table' });
  }

  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work with single groupby', () => {
    verify(PIVOT_TABLE_FORM_DATA);
    cy.get('.chart-container tr:eq(0) th:eq(1)').contains('sum__num');
    cy.get('.chart-container tr:eq(1) th:eq(0)').contains('state');
    cy.get('.chart-container tr:eq(2) th:eq(0)').contains('name');
  });

  it('should work with more than one groupby', () => {
    verify({
      ...PIVOT_TABLE_FORM_DATA,
      groupby: ['name', 'gender'],
    });
    cy.get('.chart-container tr:eq(0) th:eq(2)').contains('sum__num');
    cy.get('.chart-container tr:eq(1) th:eq(1)').contains('state');
    cy.get('.chart-container tr:eq(2) th:eq(0)').contains('name');
    cy.get('.chart-container tr:eq(2) th:eq(1)').contains('gender');
  });

  it('should work with multiple metrics', () => {
    verify({
      ...PIVOT_TABLE_FORM_DATA,
      metrics: ['sum__num', TEST_METRIC],
    });
    cy.get('.chart-container tr:eq(0) th:eq(1)').contains('sum__num');
    cy.get('.chart-container tr:eq(0) th:eq(2)').contains('SUM(num_boys)');
    cy.get('.chart-container tr:eq(1) th:eq(0)').contains('state');
    cy.get('.chart-container tr:eq(2) th:eq(0)').contains('name');
  });

  it('should work with multiple groupby and multiple metrics', () => {
    verify({
      ...PIVOT_TABLE_FORM_DATA,
      groupby: ['name', 'gender'],
      metrics: ['sum__num', TEST_METRIC],
    });
    cy.get('.chart-container tr:eq(0) th:eq(2)').contains('sum__num');
    cy.get('.chart-container tr:eq(0) th:eq(3)').contains('SUM(num_boys)');
    cy.get('.chart-container tr:eq(2) th:eq(0)').contains('name');
    cy.get('.chart-container tr:eq(2) th:eq(1)').contains('gender');
  });
});
