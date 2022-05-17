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

  it('allows you to create a tab', () => {
    cy.get('[data-test="sql-editor-tabs"]').then(tabList => {
      const initialTabCount = tabList.length;
      // add tab
      cy.get('[data-test="add-tab-icon"]').first().click();
      // wait until we find the new tab
      cy.get('[data-test="sql-editor-tabs"]')
        .children()
        .eq(0)
        .contains(`Untitled Query ${initialTabCount}`);
      cy.get('[data-test="sql-editor-tabs"]')
        .children()
        .eq(0)
        .contains(`Untitled Query ${initialTabCount + 1}`);
    });
  });

  it('allows you to close a tab', () => {
    cy.get('[data-test="sql-editor-tabs"]')
      .children()
      .then(tabListA => {
        const initialTabCount = tabListA.length;

        // open the tab dropdown to remove
        cy.get('[data-test="dropdown-toggle-button"]')
          .children()
          .first()
          .click({
            force: true,
          });

        // first item is close
        cy.get('[data-test="close-tab-menu-option"]').click();

        cy.get('[data-test="sql-editor-tabs"]').should(
          'have.length',
          initialTabCount - 1,
        );
      });
  });
});
