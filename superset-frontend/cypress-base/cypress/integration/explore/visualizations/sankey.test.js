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
describe('Visualization > Sankey', () => {
  const SANKEY_FORM_DATA = {
    datasource: '1__table',
    viz_type: 'sankey',
    slice_id: 1,
    url_params: {},
    granularity_sqla: null,
    time_grain_sqla: 'P1D',
    time_range: 'Last+week',
    groupby: ['source', 'target'],
    metric: 'sum__value',
    adhoc_filters: [],
    row_limit: '5000',
    color_scheme: 'bnbColors',
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  }

  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  it('should work', () => {
    verify(SANKEY_FORM_DATA);
    cy.get('.chart-container svg g.node rect').should('have.length', 41);
  });

  it('should work with filter', () => {
    verify({
      ...SANKEY_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SQL',
          sqlExpression: 'SUM(value)+>+0',
          clause: 'HAVING',
          subject: null,
          operator: null,
          comparator: null,
          filterOptionName: 'filter_jbdwe0hayaj_h9jfer8fy58',
        },
        {
          expressionType: 'SIMPLE',
          subject: 'source',
          operator: '==',
          comparator: 'Energy',
          clause: 'WHERE',
          sqlExpression: null,
          filterOptionName: 'filter_8e0otka9uif_vmqri4gmbqc',
        },
      ],
    });
    cy.get('.chart-container svg g.node rect').should('have.length', 6);
  });
});
