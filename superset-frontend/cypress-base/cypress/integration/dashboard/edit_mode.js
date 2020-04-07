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
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

export default () =>
  describe('edit mode', () => {
    beforeEach(() => {
      cy.server();
      cy.login();
      cy.visit(WORLD_HEALTH_DASHBOARD);
      cy.get('.dashboard-header')
        .contains('Edit dashboard')
        .click();
    });

    it('remove, and add chart flow', () => {
      // wait for box plot to appear
      cy.get('.grid-container .box_plot');

      cy.get('.fa.fa-trash')
        .last()
        .then($el => {
          cy.wrap($el)
            .invoke('show')
            .click();
          // box plot should be gone
          cy.get('.grid-container .box_plot').should('not.exist');
        });

      // open charts list
      cy.get('.component-layer')
        .contains('Your charts & filters')
        .click();

      // find box plot is available from list
      cy.get('.slices-layer')
        .find('.chart-card-container')
        .contains('Box plot');

      // drag-n-drop
      const dataTransfer = { data: {} };
      cy.get('.dragdroppable')
        .contains('Box plot')
        .trigger('mousedown', { which: 1 })
        .trigger('dragstart', { dataTransfer })
        .trigger('drag', {});
      cy.get('.grid-content div.grid-row.background--transparent')
        .last()
        .trigger('dragover', { dataTransfer })
        .trigger('drop', { dataTransfer })
        .trigger('dragend', { dataTransfer })
        .trigger('mouseup', { which: 1 });

      // add back to dashboard
      cy.get('.grid-container .box_plot').should('be.exist');

      // should show Save changes button
      cy.get('.dashboard-header .button-container').contains('Save changes');

      // undo 2 steps
      cy.get('.dashboard-header .undo-action')
        .click()
        .click();

      // no changes, can switch to view mode
      cy.get('.dashboard-header .button-container')
        .contains('Switch to view mode')
        .click();
    });
  });
