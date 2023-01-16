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
import { WORLD_HEALTH_DASHBOARD } from 'cypress/utils/urls';
import { waitForChartLoad } from 'cypress/utils';
import { WORLD_HEALTH_CHARTS } from './utils';

describe('Dashboard load', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
    WORLD_HEALTH_CHARTS.forEach(waitForChartLoad);
  });

  afterEach(() => {
    cy.eyesClose();
  });

  it('should load the Dashboard', () => {
    cy.eyesOpen({
      testName: 'Dashboard page',
    });
    cy.eyesCheckWindow('Dashboard loaded');
  });

  it('should load the Dashboard in edit mode', () => {
    cy.get('.header-with-actions')
      .find('[aria-label="Edit dashboard"]')
      .click();
    // wait for a chart to appear
    cy.get('[data-test="grid-container"]').find('.box_plot', {
      timeout: 10000,
    });
    cy.eyesOpen({
      testName: 'Dashboard edit mode',
    });
    cy.eyesCheckWindow('Dashboard edit mode loaded');
  });
});
