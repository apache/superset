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
export default () =>
  describe('Dual Line', () => {
    const DUAL_LINE_FORM_DATA = {
      datasource: '3__table',
      viz_type: 'dual_line',
      slice_id: 58,
      granularity_sqla: 'ds',
      time_grain_sqla: 'P1D',
      time_range: '100+years+ago+:+now',
      color_scheme: 'bnbColors',
      x_axis_format: 'smart_date',
      metric: 'avg__num',
      y_axis_format: '.3s',
      metric_2: 'sum__num',
      y_axis_2_format: '.3s',
      adhoc_filters: [],
      annotation_layers: [],
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
      verify(DUAL_LINE_FORM_DATA);
      cy.get('.chart-container svg path.nv-line').should('have.length', 2);
    });

    it('should work with filter', () => {
      verify({
        ...DUAL_LINE_FORM_DATA,
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            subject: 'gender',
            operator: '==',
            comparator: 'girl',
            clause: 'WHERE',
            sqlExpression: null,
            filterOptionName: 'filter_1ep6q50g8vk_48jj6qxdems',
          },
        ],
      });
      cy.get('.chart-container svg path.nv-line').should('have.length', 2);
    });
  });
