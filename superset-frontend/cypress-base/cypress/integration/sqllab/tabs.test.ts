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
describe('SqlLab query tabs', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/superset/sqllab');
  });

  it('allows you to create and close a tab', () => {
    const tablistSelector = '[data-test="sql-editor-tabs"] > [role="tablist"]';
    const tabSelector = `${tablistSelector} [role="tab"]`;
    cy.get(tabSelector).then(tabs => {
      const initialTabCount = tabs.length;
      const initialUntitledCount = Math.max(
        0,
        ...tabs
          .map((i, tabItem) =>
            Number(tabItem.textContent?.match(/Untitled Query (\d+)/)?.[1]),
          )
          .toArray(),
      );

      // add two new tabs
      cy.get('[data-test="add-tab-icon"]:visible:last').click();
      cy.contains('[role="tab"]', `Untitled Query ${initialUntitledCount + 1}`);
      cy.get(tabSelector).should('have.length', initialTabCount + 1);

      cy.get('[data-test="add-tab-icon"]:visible:last').click();
      cy.contains('[role="tab"]', `Untitled Query ${initialUntitledCount + 2}`);
      cy.get(tabSelector).should('have.length', initialTabCount + 2);

      // close the tabs
      cy.get(`${tabSelector}:last [data-test="dropdown-trigger"]`).click({
        force: true,
      });
      cy.get('[data-test="close-tab-menu-option"]').click();
      cy.get(tabSelector).should('have.length', initialTabCount + 1);
      cy.contains('[role="tab"]', `Untitled Query ${initialUntitledCount + 1}`);

      cy.get(`${tablistSelector} [aria-label="remove"]:last`).click();
      cy.get(tabSelector).should('have.length', initialTabCount);
    });
  });
});
