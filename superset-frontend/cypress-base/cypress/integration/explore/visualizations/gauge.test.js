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
describe('Visualization > Gauge', () => {
  const GAUGE_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'gauge_chart',
    metric: 'count',
    adhoc_filters: [],
    slice_id: 49,
    row_limit: 10,
  };

  function verify(formData) {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  }

  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '/api/v1/chart/data*').as('getJson');
  });

  it('should work', () => {
    verify(GAUGE_FORM_DATA);
    cy.get('.chart-container .gauge_chart canvas').should('have.length', 1);
  });

  it('should work with simple filter', () => {
    verify({
      ...GAUGE_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'country_code',
          operator: '==',
          comparator: 'USA',
          clause: 'WHERE',
          sqlExpression: null,
          isExtra: false,
          isNew: false,
          filterOptionName: 'filter_jaemvkxd5h_ku22m3wyo',
        },
      ],
    });
    cy.get('.chart-container .gauge_chart canvas').should('have.length', 1);
  });
});
