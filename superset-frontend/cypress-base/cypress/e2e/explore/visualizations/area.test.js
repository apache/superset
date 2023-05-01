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
describe('Visualization > Area', () => {
  beforeEach(() => {
    cy.intercept('POST', '/api/v1/chart/data**').as('getChartData');
  });

  const AREA_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'echarts_area',
    slice_id: 48,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '1960-01-01 : now',
    metrics: ['sum__SP_POP_TOTL'],
    adhoc_filters: [],
    groupby: [],
    limit: '25',
    order_desc: true,
    contribution: false,
    row_limit: 50000,
    show_brush: 'auto',
    show_legend: true,
    line_interpolation: 'linear',
    stacked_style: 'stack',
    color_scheme: 'bnbColors',
    rich_tooltip: true,
    show_controls: false,
    x_axis_label: '',
    bottom_margin: 'auto',
    x_ticks_layout: 'auto',
    x_axis_format: 'smart_date',
    x_axis_showminmax: false,
    y_axis_format: '.3s',
    y_log_scale: false,
    rolling_type: 'None',
    comparison_type: 'values',
    annotation_layers: [],
  };

  function verify(formData) {
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getChartData' });
  }

  it('should work without groupby', () => {
    verify(AREA_FORM_DATA);
  });

  it('should work with group by', () => {
    verify({
      ...AREA_FORM_DATA,
      groupby: ['region'],
    });
  });

  it('should work with groupby and filter', () => {
    verify({
      ...AREA_FORM_DATA,
      groupby: ['region'],
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
  });

  it('should allow type to search color schemes and apply the scheme', () => {
    verify(AREA_FORM_DATA);

    cy.get('#controlSections-tab-display').click();
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]')
      .focus()
      .type('supersetColors{enter}');
    cy.get(
      '.Control[data-test="color_scheme"] .ant-select-selection-item [data-test="supersetColors"]',
    ).should('exist');
  });
});
