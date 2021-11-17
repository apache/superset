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
import { CHART_LIST } from './chart_list.helper';

describe('chart card view', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(CHART_LIST);
    cy.get('[aria-label="card-view"]').click();
  });

  it('should load cards', () => {
    cy.get('[data-test="chart-list-view"]');
    cy.get('[data-test="styled-card"]').should('be.visible');
    cy.get('[data-test="styled-card"]').should('have.length', 25);
  });

  it('should allow to favorite/unfavorite chart card', () => {
    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-selected']")
      .should('not.exist');
    cy.get("[data-test='card-actions']")
      .find("[aria-label='favorite-unselected']")
      .first()
      .click();
    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-selected']")
      .should('be.visible');
    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-unselected']")
      .should('not.exist');

    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-unselected']")
      .should('not.exist');
    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-selected']")
      .click();
    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-unselected']")
      .should('be.visible');
    cy.get("[data-test='card-actions']")
      .first()
      .find("[aria-label='favorite-selected']")
      .should('not.exist');
  });

  xit('should sort correctly', () => {
    // sort Alphabetical
    cy.get('.Select__control').last().should('be.visible');
    cy.get('.Select__control').last().click();
    cy.get('.Select__menu').contains('Alphabetical').click();
    cy.get('[data-test="chart-list-view"]').should('be.visible');
    cy.get('[data-test="styled-card"]').first().contains('% Rural');

    // sort Recently Modified
    cy.get('.Select__control').last().should('be.visible');
    cy.get('.Select__control').last().click();
    cy.get('.Select__menu').contains('Recently Modified').click();
    cy.get('[data-test="chart-list-view"]').should('be.visible');
    // TODO - next line is/was flaky
    cy.get('[data-test="styled-card"]').first().contains('Unicode Cloud');
    cy.get('[data-test="styled-card"]')
      .last()
      .contains('Life Expectancy VS Rural %');
  });

  // flaky
  xit('should delete correctly', () => {
    // show delete modal
    cy.get('[data-test="more-horiz"]').last().trigger('mouseover');
    cy.get('[data-test="chart-list-delete-option"]')
      .last()
      .should('be.visible');
    cy.get('[data-test="chart-list-delete-option"]')
      .last()
      .contains('Delete')
      .click();
    cy.get('[data-test="Please Confirm-modal"]').should('be.visible');
    cy.get('[data-test="modal-confirm-button"]').should(
      'have.attr',
      'disabled',
    );
    cy.get('[data-test="Please Confirm-modal"]').should('be.visible');
    cy.get("[data-test='delete-modal-input']").type('DELETE');
    cy.get('[data-test="modal-confirm-button"]').should(
      'not.have.attr',
      'disabled',
    );
    cy.get('[data-test="modal-cancel-button"]').click();
  });

  // flaky
  xit('should edit correctly', () => {
    // show edit modal
    cy.get('[data-test="more-horiz"]').last().trigger('mouseover');
    cy.get('[data-test="chart-list-edit-option"]').last().should('be.visible');
    cy.get('[data-test="chart-list-edit-option"]').last().click();
    cy.get('[data-test="properties-edit-modal"]').should('be.visible');
    cy.get('[data-test="properties-modal-name-input"]').should(
      'not.have.value',
    );
    cy.get('[data-test="properties-modal-cancel-button"]')
      .contains('Cancel')
      .click();
  });
});
