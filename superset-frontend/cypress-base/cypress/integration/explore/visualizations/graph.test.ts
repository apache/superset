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
type adhocFilter = {
  expressionType: string;
  subject: string;
  operator: string;
  comparator: string;
  clause: string;
  sqlExpression: string | null;
  filterOptionName: string;
};

describe('Visualization > Graph', () => {
  const GRAPH_FORM_DATA = {
    datasource: '1__table',
    viz_type: 'graph_chart',
    slice_id: 55,
    granularity_sqla: 'ds',
    time_grain_sqla: 'P1D',
    time_range: '100 years ago : now',
    metric: 'sum__value',
    adhoc_filters: [],
    source: 'source',
    target: 'target',
    row_limit: 50000,
    show_legend: true,
    color_scheme: 'bnbColors',
  };

  function verify(formData: {
    [name: string]: string | boolean | number | Array<adhocFilter>;
  }): void {
    cy.visitChartByParams(JSON.stringify(formData));
    cy.verifySliceSuccess({ waitAlias: '@getJson' });
  }

  beforeEach(() => {
    cy.login();
    cy.intercept('POST', '/api/v1/chart/data*').as('getJson');
  });

  it('should work with ad-hoc metric', () => {
    verify(GRAPH_FORM_DATA);
    cy.get('.chart-container .graph_chart canvas').should('have.length', 1);
  });

  it('should work with simple filter', () => {
    verify({
      ...GRAPH_FORM_DATA,
      adhoc_filters: [
        {
          expressionType: 'SIMPLE',
          subject: 'source',
          operator: '==',
          comparator: 'Agriculture',
          clause: 'WHERE',
          sqlExpression: null,
          filterOptionName: 'filter_tqx1en70hh_7nksse7nqic',
        },
      ],
    });
    cy.get('.chart-container .graph_chart canvas').should('have.length', 1);
  });
});
