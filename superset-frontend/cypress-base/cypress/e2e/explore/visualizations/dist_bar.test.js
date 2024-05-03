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
import { FORM_DATA_DEFAULTS, NUM_METRIC } from './shared.helper';

describe('Visualization > Distribution bar chart', () => {
  beforeEach(() => {
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  const VIZ_DEFAULTS = { ...FORM_DATA_DEFAULTS, viz_type: 'dist_bar' };
  const DISTBAR_FORM_DATA = {
    ...VIZ_DEFAULTS,
    metrics: NUM_METRIC,
    groupby: ['state'],
  };

  it('should work with adhoc metric', () => {
    cy.visitChartByParams(DISTBAR_FORM_DATA);
    cy.verifySliceSuccess({
      waitAlias: '@getJson',
      querySubstring: NUM_METRIC.label,
      chartSelector: 'svg',
    });
  });

  it('should work with series', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
      columns: ['gender'],
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with row limit', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
      row_limit: 10,
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should work with contribution', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
      columns: ['gender'],
      contribution: true,
    };

    cy.visitChartByParams(formData);
    cy.verifySliceSuccess({ waitAlias: '@getJson', chartSelector: 'svg' });
  });

  it('should allow type to search color schemes and apply the scheme', () => {
    cy.visitChartByParams(DISTBAR_FORM_DATA);

    cy.get('#controlSections-tab-display').click();
    cy.get('.Control[data-test="color_scheme"]').scrollIntoView();
    cy.get('.Control[data-test="color_scheme"] input[type="search"]')
      .focus()
      .type('bnbColors{enter}');
    cy.get(
      '.Control[data-test="color_scheme"] .ant-select-selection-item [data-test="bnbColors"]',
    ).should('exist');
    cy.get('.dist_bar .nv-legend .nv-legend-symbol')
      .first()
      .should('have.css', 'fill', 'rgb(41, 105, 107)');
  });
});
