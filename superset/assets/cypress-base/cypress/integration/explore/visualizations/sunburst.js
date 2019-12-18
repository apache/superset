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
  describe('Sunburst', () => {
    const SUNBURST_FORM_DATA = {
      datasource: '2__table',
      viz_type: 'sunburst',
      slice_id: 47,
      granularity_sqla: 'year',
      time_grain_sqla: 'P1D',
      time_range: '2011-01-01+:+2011-01-01',
      groupby: ['region'],
      metric: 'sum__SP_POP_TOTL',
      adhoc_filters: [],
      row_limit: 50000,
      color_scheme: 'bnbColors',
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

    it('should work without secondary metric', () => {
      verify(SUNBURST_FORM_DATA);
      // There should be 7 visible arcs + 1 hidden
      cy.get('.chart-container svg g#arcs path').should('have.length', 8);
    });

    it('should work with secondary metric', () => {
      verify({
        ...SUNBURST_FORM_DATA,
        secondary_metric: 'sum__SP_RUR_TOTL',
      });
      cy.get('.chart-container svg g#arcs path').should('have.length', 8);
    });

    it('should work with multiple groupbys', () => {
      verify({
        ...SUNBURST_FORM_DATA,
        groupby: ['region', 'country_name'],
      });
      cy.get('.chart-container svg g#arcs path').should('have.length', 118);
    });

    it('should work with filter', () => {
      verify({
        ...SUNBURST_FORM_DATA,
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            subject: 'region',
            operator: 'in',
            comparator: ['South Asia', 'North America'],
            clause: 'WHERE',
            sqlExpression: null,
            fromFormData: true,
            filterOptionName: 'filter_txje2ikiv6_wxmn0qwd1xo',
          },
        ],
      });
      cy.get('.chart-container svg g#arcs path').should('have.length', 3);
    });
  });
