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
describe('Visualization > Bubble', () => {
  const BUBBLE_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'bubble',
    slice_id: 46,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '2011-01-01+:+2011-01-02',
    series: 'region',
    entity: 'country_name',
    x: 'sum__SP_RUR_TOTL_ZS',
    y: 'sum__SP_DYN_LE00_IN',
    size: 'sum__SP_POP_TOTL',
    max_bubble_size: '50',
    limit: 0,
    color_scheme: 'bnbColors',
    show_legend: true,
    x_axis_label: '',
    left_margin: 'auto',
    x_axis_format: '.3s',
    x_ticks_layout: 'auto',
    x_log_scale: false,
    x_axis_showminmax: false,
    y_axis_label: '',
    bottom_margin: 'auto',
    y_axis_format: '.3s',
    y_log_scale: false,
    y_axis_showminmax: false,
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  }

  beforeEach(() => {
    cy.server();
    cy.login();
    cy.route('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work', () => {
    verify(BUBBLE_FORM_DATA);
    // number of circles = 214 rows
    cy.get('.chart-container svg .nv-point-clips circle').should(
      'have.length',
      214,
    );
  });

  it('should work with filter', () => {
    verify({
      ...BUBBLE_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'region',
          operator: '==',
          comparator: 'South+Asia',
          clause: 'WHERE',
          sqlExpression: null,
          filterOptionName: 'filter_b2tfg1rs8y_8kmrcyxvsqd',
        },
      ],
    });
    cy.get('.chart-container svg .nv-point-clips circle')
      .should('have.length', 8)
      .then(nodeList => {
        // Check that all circles have same color.
        const color = nodeList[0].getAttribute('fill');
        const circles = Array.prototype.slice.call(nodeList);
        expect(circles.every(c => c.getAttribute('fill') === color)).to.equal(
          true,
        );
      });
  });
});
