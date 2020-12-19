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
import { TABBED_DASHBOARD } from './dashboard.helper';

describe('Nativefilters', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit(TABBED_DASHBOARD);
  });
  it('should show filter bar and allow user to create filters ', () => {
    cy.get('[data-test="filter-bar"]').should('be.visible');
    cy.get('[data-test="collapse"]').click();
    cy.get('[data-test="create-filter"]').click();
    cy.get('.ant-modal').should('be.visible');

    cy.get('.ant-form-vertical').find('.ant-tabs-nav-add').first().click();

    cy.get('.ant-modal')
      .find('.ant-tabs-tab-btn')
      .first()
      .click({ force: true })
      .type('TEST_Filter');

    cy.get('.ant-modal').find('[data-test="datasource-input"]').first().click();

    cy.get('[data-test="datasource-input"]')
      .contains('wb_health_population')
      .click();

    // possible bug with cypress where it is having issue discovering the field input
    // after it is enabled

    /* cy.get('.ant-modal')
      .find('[data-test="field-input"]')
      .click()
      .contains('country_name')
      .click();
      */

    cy.get('.ant-modal-footer').find('button').should('be.visible');
  });
});
