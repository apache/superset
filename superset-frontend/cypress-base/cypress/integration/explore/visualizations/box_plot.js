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
  describe('Box Plot', () => {
    const BOX_PLOT_FORM_DATA = {
      datasource: '2__table',
      viz_type: 'box_plot',
      slice_id: 49,
      granularity_sqla: 'year',
      time_grain_sqla: 'P1D',
      time_range: '1960-01-01+:+now',
      metrics: ['sum__SP_POP_TOTL'],
      adhoc_filters: [],
      groupby: ['region'],
      limit: '25',
      color_scheme: 'bnbColors',
      whisker_options: 'Min/max+(no+outliers)',
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
      verify(BOX_PLOT_FORM_DATA);
      cy.get('.chart-container svg rect.nv-boxplot-box').should(
        'have.length',
        7,
      );
    });

    it('should work with filter', () => {
      verify({
        ...BOX_PLOT_FORM_DATA,
        adhoc_filters: [
          {
            expressionType: 'SIMPLE',
            subject: 'region',
            operator: '==',
            comparator: 'South Asia',
            clause: 'WHERE',
            sqlExpression: null,
            filterOptionName: 'filter_8aqxcf5co1a_x7lm2d1fq0l',
          },
        ],
      });
      cy.get('.chart-container svg rect.nv-boxplot-box').should(
        'have.length',
        1,
      );
    });
  });
