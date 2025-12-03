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

describe('Download Chart > Bar chart', () => {
  const VIZ_DEFAULTS = {
    ...FORM_DATA_DEFAULTS,
    viz_type: 'echarts_timeseries_bar',
  };

  beforeEach(() => {
    cy.intercept('POST', '**/superset/explore_json/**').as('getJson');
  });

  it('download chart with image works', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
    };

    cy.visitChartByParams(formData);
    // 1) Open "Data Export Options"
    cy.get('body .ant-dropdown-menu-title-content')
      .contains(/^Data Export Options$/)
      .parents('.ant-dropdown-menu-submenu-title')
      .trigger('mouseover', { force: true })
      .click({ force: true });
    // 2) Open "Export All Data"
    cy.get('body .ant-dropdown-menu-title-content')
      .contains(/^Export All Data$/)
      .parents('.ant-dropdown-menu-submenu-title')
      .trigger('mouseover', { force: true })
      .click({ force: true });
    // 3) Click the specific format (avoid partial "Export" matches)
    cy.get('body li.ant-dropdown-menu-item')
      .contains(/^Export to \.CSV$/)
      .should('be.visible')
      .click({ force: true });
    cy.verifyDownload('.jpg', {
      contains: true,
      timeout: 25000,
      interval: 600,
    });
  });
});
