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

import { DATASET_LIST_PATH } from 'cypress/utils/urls';

describe('Dataset list', () => {
  before(() => {
    cy.visit(DATASET_LIST_PATH);
  });

  beforeEach(() => {
    cy.preserveLogin();
  });

  it('should open Explore on dataset name click', () => {
    cy.intercept('**/api/v1/explore/**').as('explore');
    cy.get('[data-test="listview-table"] [data-test="internal-link"]')
      .contains('birth_names')
      .click();
    cy.wait('@explore');
    cy.get('[data-test="datasource-control"] .title-select').contains(
      'birth_names',
    );
    cy.get('.metric-option-label').first().contains('COUNT(*)');
    cy.get('.column-option-label').first().contains('ds');
    cy.get('[data-test="fast-viz-switcher"] > div:not([role="button"]')
      .contains('Table')
      .should('be.visible');
  });
});
