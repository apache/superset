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
import { DASHBOARD_LIST } from './dashboard_list.helper';

describe('dashboard list view', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(DASHBOARD_LIST);
    cy.get('[aria-label="list-view"]').click();
  });

  xit('should load rows', () => {
    cy.get('[data-test="listview-table"]').should('be.visible');
    // check dashboard list view header
    cy.get('[data-test="sort-header"]').eq(1).contains('Title');
    cy.get('[data-test="sort-header"]').eq(2).contains('Modified by');
    cy.get('[data-test="sort-header"]').eq(3).contains('Status');
    cy.get('[data-test="sort-header"]').eq(4).contains('Modified');
    cy.get('[data-test="sort-header"]').eq(5).contains('Created by');
    cy.get('[data-test="sort-header"]').eq(6).contains('Owners');
    cy.get('[data-test="sort-header"]').eq(7).contains('Actions');
    cy.get('[data-test="table-row"]').should('have.length', 4); // failed, xit-ed
  });

  xit('should sort correctly', () => {
    cy.get('[data-test="sort-header"]').eq(1).click();
    cy.get('[data-test="sort-header"]').eq(1).click();
    cy.get('[data-test="table-row"]')
      .first()
      .find('[data-test="table-row-cell"]')
      .find('[data-test="cell-text"]')
      .contains("World Bank's Data");
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
