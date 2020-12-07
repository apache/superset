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
describe('Visualization > Big Number with Trendline', () => {
  const BIG_NUMBER_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'big_number',
    slice_id: 42,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '2000+:+2014-01-02',
    metric: 'sum__SP_POP_TOTL',
    adhoc_filters: [],
    compare_lag: '10',
    compare_suffix: 'over+10Y',
    y_axis_format: '.3s',
    show_trend_line: true,
    start_y_axis_at_zero: true,
    color_picker: {
      r: 0,
      g: 122,
      b: 135,
      a: 1,
    },
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      chartSelector: '.superset-legacy-chart-big-number',
    });
  }

  beforeEach(() => {
    cy.login();
    cy.server();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work', () => {
    verify(BIG_NUMBER_FORM_DATA);
    cy.get('.chart-container .header-line');
    cy.get('.chart-container .subheader-line');
    cy.get('.chart-container svg path.vx-linepath');
  });

  it('should work without subheader', () => {
    verify({
      ...BIG_NUMBER_FORM_DATA,
      compare_lag: null,
    });
    cy.get('.chart-container .header-line');
    cy.get('.chart-container .subheader-line').should('not.exist');
    cy.get('.chart-container svg path.vx-linepath');
  });

  it('should not render trendline when hidden', () => {
    verify({
      ...BIG_NUMBER_FORM_DATA,
      show_trend_line: false,
    });
    cy.get('[data-test="chart-container"] .header-line');
    cy.get('[data-test="chart-container"] .subheader-line');
    cy.get('[data-test="chart-container"] svg').should('not.exist');
  });
});
