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
import { DASHBOARD_LIST } from 'cypress/utils/urls';
import { setGridMode, clearAllInputs } from 'cypress/utils';
import { setFilter } from '../dashboard/utils';

describe('Dashboards filters', () => {
  before(() => {
    cy.visit(DASHBOARD_LIST);
  });

  beforeEach(() => {
    cy.preserveLogin();
    clearAllInputs();
  });

  describe('card-view', () => {
    before(() => {
      setGridMode('card');
    });

    it('should filter by owners correctly', () => {
      setFilter('Owner', 'alpha user');
      cy.getBySel('styled-card').should('not.exist');
      setFilter('Owner', 'admin user');
      cy.getBySel('styled-card').should('exist');
    });

    it('should filter by created by correctly', () => {
      setFilter('Created by', 'alpha user');
      cy.getBySel('styled-card').should('not.exist');
      setFilter('Created by', 'admin user');
      cy.getBySel('styled-card').should('exist');
    });

    it('should filter by published correctly', () => {
      setFilter('Status', 'Published');
      cy.getBySel('styled-card').should('have.length', 3);
      setFilter('Status', 'Draft');
      cy.getBySel('styled-card').should('have.length', 2);
    });
  });

  describe('list-view', () => {
    before(() => {
      setGridMode('list');
    });

    it('should filter by created by correctly', () => {
      setFilter('Owner', 'alpha user');
      cy.getBySel('table-row').should('not.exist');
      setFilter('Owner', 'admin user');
      cy.getBySel('table-row').should('exist');
    });

    it('should filter by created by correctly', () => {
      setFilter('Created by', 'alpha user');
      cy.getBySel('table-row').should('not.exist');
      setFilter('Created by', 'admin user');
      cy.getBySel('table-row').should('exist');
    });

    it('should filter by published correctly', () => {
      setFilter('Status', 'Published');
      cy.getBySel('table-row').should('have.length', 3);
      setFilter('Status', 'Draft');
      cy.getBySel('table-row').should('have.length', 2);
    });
  });
});
