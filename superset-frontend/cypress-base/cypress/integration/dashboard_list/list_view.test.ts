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
    cy.server();
    cy.visit(DASHBOARD_LIST);
    cy.get('[data-test="list-view"]').click();
  });

  it('should load rows', () => {
    cy.get('.dashboard-list-view');
    cy.get('table[role="table"]').should('be.visible');
    // check dashboard list view header
    cy.get('th[role="columnheader"]:nth-child(2)').contains('Title');
    cy.get('th[role="columnheader"]:nth-child(3)').contains('Owners');
    cy.get('th[role="columnheader"]:nth-child(4)').contains('Modified By');
    cy.get('th[role="columnheader"]:nth-child(5)').contains('Published');
    cy.get('th[role="columnheader"]:nth-child(6)').contains('Modified');
    cy.get('th[role="columnheader"]:nth-child(7)').contains('Actions');
    cy.get('.table-row').should('have.length', 4);
  });

  it('should sort correctly', () => {
    cy.get('th[role="columnheader"]:nth-child(2)').click();
    cy.get('.table-row td:nth-child(2):eq(0)').contains('Tabbed Dashboard');
    cy.get('th[role="columnheader"]:nth-child(6)').click();
    cy.get('.table-row  td:nth-child(2):eq(0)').contains("World Bank's Data");
  });
});
