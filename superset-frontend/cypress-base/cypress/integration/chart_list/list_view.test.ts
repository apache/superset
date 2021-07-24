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

describe('chart list view', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(CHART_LIST);
    cy.get('[aria-label="list-view"]').click();
  });

  it('should load rows', () => {
    cy.get('[data-test="listview-table"]').should('be.visible');
    // check chart list view header
    cy.get('[data-test="sort-header"]').eq(1).contains('Chart');
    cy.get('[data-test="sort-header"]').eq(2).contains('Visualization type');
    cy.get('[data-test="sort-header"]').eq(3).contains('Dataset');
    cy.get('[data-test="sort-header"]').eq(4).contains('Modified by');
    cy.get('[data-test="sort-header"]').eq(5).contains('Last modified');
    cy.get('[data-test="sort-header"]').eq(6).contains('Created by');
    cy.get('[data-test="sort-header"]').eq(7).contains('Actions');
    cy.get('[data-test="table-row"]').should('have.length', 25);
  });

  xit('should sort correctly', () => {
    cy.get('[data-test="sort-header"]').eq(2).click();
    cy.get('[data-test="sort-header"]').eq(2).click();
    cy.get('[data-test="table-row"]')
      .first()
      .find('[data-test="table-row-cell"]')
      .find('[data-test="cell-text"]')
      .contains('Location of Current Developers');
  });

  it('should bulk delete correctly', () => {
    cy.get('[data-test="listview-table"]').should('be.visible');
    cy.get('[data-test="bulk-select"]').eq(0).click();
    cy.get('[aria-label="checkbox-off"]').eq(1).siblings('input').click();
    cy.get('[aria-label="checkbox-off"]').eq(2).siblings('input').click();
    cy.get('[data-test="bulk-select-action"]').eq(0).click();
    cy.get('[data-test="delete-modal-input"]').eq(0).type('DELETE');
    cy.get('[data-test="modal-confirm-button"]').eq(0).click();
    cy.get('[aria-label="checkbox-on"]').should('not.exist');
  });
});
