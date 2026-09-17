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
describe('Visualization > Pie', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/chart/data*').as('getJson');
  });

  const PIE_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'pie',
    slice_id: 55,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    metric: 'sum__num',
    adhoc_filters: [],
    groupby: ['gender'],
    row_limit: 50000,
    pie_label_type: 'key',
    donut: false,
    show_legend: true,
    show_labels: true,
    labels_outside: true,
    color_scheme: 'bnbColors',
  };

  function verify(formData) {
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  }

  it('should work with ad-hoc metric', () => {
    verify(PIE_FORM_DATA);
    cy.get('.chart-container .pie canvas').should('have.length', 1);
  });

  it('should work with simple filter', () => {
    verify({
      ...PIE_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'gender',
          operator: '==',
          comparator: 'boy',
          clause: 'WHERE',
          sqlExpression: null,
          filterOptionName: 'filter_tqx1en70hh_7nksse7nqic',
        },
      ],
    });
    cy.get('.chart-container .pie canvas').should('have.length', 1);
  });

  it('should allow type to search color schemes', () => {
    verify(PIE_FORM_DATA);

    cy.get('#controlSections-tab-display').click();
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]').focus();
    cy.focused().type('supersetColors{enter}');
    cy.get(
      '.Control[data-test="color_scheme"] .ant-select-selection-item [data-test="supersetColors"]',
    ).should('exist');
  });
});
