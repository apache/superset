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
describe('Visualization > Sunburst', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/chart/data**').as('chartData');
  });

  const SUNBURST_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'sunburst_v2',
    slice_id: 47,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: 'No filter',
    columns: ['region'],
    metric: 'sum__SP_POP_TOTL',
    adhoc_filters: [],
    row_limit: 50000,
    color_scheme: 'bnbColors',
  };

  function verify(formData) {
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@chartData' });
  }

  // requires the ability to render charts using SVG only for tests
  it.skip('should work without secondary metric', () => {
    verify(SUNBURST_FORM_DATA);
    cy.get('.chart-container svg g path').should('have.length', 7);
  });

  // requires the ability to render charts using SVG only for tests
  it.skip('should work with secondary metric', () => {
    verify({
      ...SUNBURST_FORM_DATA,
      secondary_metric: 'sum__SP_RUR_TOTL',
    });
    cy.get('.chart-container svg g path').should('have.length', 7);
  });

  // requires the ability to render charts using SVG only for tests
  it.skip('should work with multiple columns', () => {
    verify({
      ...SUNBURST_FORM_DATA,
      columns: ['region', 'country_name'],
    });
    cy.get('.chart-container svg g path').should('have.length', 221);
  });

  // requires the ability to render charts using SVG only for tests
  it.skip('should work with filter', () => {
    verify({
      ...SUNBURST_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'region',
          operator: 'IN',
          comparator: ['South Asia', 'North America'],
          clause: 'WHERE',
          sqlExpression: null,
          filterOptionName: 'filter_txje2ikiv6_wxmn0qwd1xo',
        },
      ],
    });
    cy.get('.chart-container svg g path').should('have.length', 2);
  });

  it('should allow type to search color schemes', () => {
    verify(SUNBURST_FORM_DATA);

    cy.get('#controlSections-tab-display').click();
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]').focus();
    cy.focused().type('supersetColors{enter}');
    cy.get(
      '.Control[data-test="color_scheme"] .ant-select-selection-item [data-test="supersetColors"]',
    ).should('exist');
  });
});
