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
import {
  WORLD_HEALTH_CHARTS,
  WORLD_HEALTH_DASHBOARD,
} from './dashboard.helper';

describe('Dashboard load', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
  });

  it('should load dashboard', () => {
    // wait and verify one-by-one
    WORLD_HEALTH_CHARTS.forEach(({ name, viz }) => {
      // prettier-ignore
      cy.get('[data-test="grid-content"] [data-test="editable-title"]').contains(name)
        // use the chart title to find the chart grid component,
        // which has the chart id and viz type info
        .parentsUntil('[data-test="chart-grid-component"]').parent()
        .should('have.attr', 'data-test-viz-type', viz)
        .then(chartElement => {
          const chartId = chartElement.attr('data-test-chart-id');
          // the chart should load in under a minute
          // (big timeout so that it works in CI)
          cy.wrap(chartElement).find(`#chart-id-${chartId}`, { timeout: 30000 })
            .should('be.visible');
        });
    });
  });
});
