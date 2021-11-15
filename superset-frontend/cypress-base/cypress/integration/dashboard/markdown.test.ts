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
import { TABBED_DASHBOARD, drag, resize } from './dashboard.helper';

describe('Dashboard edit markdown', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(TABBED_DASHBOARD);
  });

  it('should add markdown component to dashboard', () => {
    cy.get('[data-test="dashboard-header"]')
      .find('[aria-label="edit-alt"]')
      .click();

    // lazy load - need to open dropdown for the scripts to load
    cy.get('[data-test="dashboard-header"]')
      .find('[aria-label="more-horiz"]')
      .click();
    cy.get('[data-test="grid-row-background--transparent"]')
      .first()
      .as('component-background-first');
    // add new markdown component
    drag('[data-test="new-component"]', 'Markdown').to(
      '@component-background-first',
    );
    cy.get('[data-test="dashboard-markdown-editor"]')
      .should(
        'have.text',
        '✨Markdown✨Markdown✨MarkdownClick here to edit markdown',
      )
      .click();

    cy.get('[data-test="dashboard-component-chart-holder"]')
      .find('.ace_content')
      .contains('Click here to edit [markdown](https://bit.ly/1dQOfRK)');

    cy.get('[data-test="dashboard-markdown-editor"]')
      .click()
      .type('Test resize');

    resize(
      '[data-test="dashboard-markdown-editor"] .resizable-container span div:last-child',
    ).to(500, 600);

    cy.get('[data-test="dashboard-markdown-editor"]').contains('Test resize');

    cy.get('@component-background-first').click('right');
    cy.get('[data-test="dashboard-component-chart-holder"]')
      .find('.ace_content')
      .should('not.exist');
  });
});
