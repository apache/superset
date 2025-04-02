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
describe('Visualization > World Map', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  const WORLD_MAP_FORM_DATA = {
    datasource: '2__table',
    viz_type: 'world_map',
    slice_id: 45,
    granularity_sqla: 'year',
    time_grain_sqla: 'P1D',
    time_range: '2014-01-01 : 2014-01-02',
    entity: 'country_code',
    country_fieldtype: 'cca3',
    metric: 'sum__SP_RUR_TOTL_ZS',
    adhoc_filters: [],
    row_limit: 50000,
    show_bubbles: true,
    secondary_metric: 'sum__SP_POP_TOTL',
    max_bubble_size: '25',
  };

  function verify(formData) {
    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  }

  it('should work with ad-hoc metric', () => {
    verify(WORLD_MAP_FORM_DATA);
    cy.get('.bubbles circle.datamaps-bubble').should('have.length', 206);
  });

  it('should work with simple filter', () => {
    verify({
      ...WORLD_MAP_FORM_DATA,
      metric: 'count',
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
    cy.get('.bubbles circle.datamaps-bubble').should('have.length', 8);
  });

  it('should hide bubbles when told so', () => {
    verify({
      ...WORLD_MAP_FORM_DATA,
      show_bubbles: false,
    });
    cy.get('.slice_container').then(containers => {
      expect(
        containers[0].querySelectorAll('.bubbles circle.datamaps-bubble')
          .length,
      ).to.equal(0);
    });
  });

  it('should allow type to search color schemes', () => {
    verify(WORLD_MAP_FORM_DATA);

    cy.get('.Control[data-test="linear_color_scheme"]').scrollIntoView();
    cy.get(
      '.Control[data-test="linear_color_scheme"] input[type="search"]',
    ).focus();
    cy.focused().type('greens{enter}');
    cy.get(
      '.Control[data-test="linear_color_scheme"] .ant-select-selection-item [data-test="greens"]',
    ).should('exist');
  });
});
