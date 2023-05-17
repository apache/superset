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
describe('Visualization > Compare', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  const COMPARE_FORM_DATA = {
    datasource: '3__table',
    viz_type: 'compare',
    slice_id: 60,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    metrics: ['count'],
    adhoc_filters: [],
    groupby: [],
    order_desc: true,
    contribution: false,
    row_limit: 50000,
    color_scheme: 'bnbColors',
    x_axis_label: 'Frequency',
    bottom_margin: 'auto',
    x_ticks_layout: 'auto',
    x_axis_format: 'smart_date',
    x_axis_showminmax: false,
    y_axis_label: 'Num',
    left_margin: 'auto',
    y_axis_showminmax: false,
    y_log_scale: false,
    y_axis_format: '.3s',
    rolling_type: 'None',
    comparison_type: 'values',
    annotation_layers: [],
  };

  function verify(formData) {
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  }

  it('should work without groupby', () => {
    verify(COMPARE_FORM_DATA);
    cy.get('.chart-container .nvd3 path.nv-line').should('have.length', 1);
  });

  it('should with group by', () => {
    verify({
      ...COMPARE_FORM_DATA,
      groupby: ['gender'],
    });
    cy.get('.chart-container .nvd3 path.nv-line').should('have.length', 2);
  });

  it('should work with filter', () => {
    verify({
      ...COMPARE_FORM_DATA,
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
    cy.get('.chart-container .nvd3 path.nv-line').should('have.length', 1);
  });

  it('should allow type to search color schemes and apply the scheme', () => {
    verify(COMPARE_FORM_DATA);

    cy.get('#controlSections-tab-display').click();
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]')
      .focus()
      .type('supersetColors{enter}');
    cy.get(
      '.Control[data-test="color_scheme"] .ant-select-selection-item [data-test="supersetColors"]',
    ).should('exist');
    cy.get('.compare .nv-legend .nv-legend-symbol')
      .first()
      .should('have.css', 'fill', 'rgb(31, 168, 201)');
  });
});
