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
    cy.intercept('POST', '/superset/explore_json/**').as('getJson');
  });

  it('download chart with image works', () => {
    const formData = {
      ...VIZ_DEFAULTS,
      metrics: NUM_METRIC,
      groupby: ['state'],
    };

    cy.visitChartByParams(formData);
    cy.get('.header-with-actions .antd5-dropdown-trigger').click();
    cy.get(':nth-child(3) > .antd5-dropdown-menu-submenu-title').click();
    cy.get(
      '.antd5-dropdown-menu-submenu > .antd5-dropdown-menu li:nth-child(3)',
    ).click();
    cy.verifyDownload('.jpg', {
      contains: true,
      timeout: 25000,
      interval: 600,
    });
  });
});
