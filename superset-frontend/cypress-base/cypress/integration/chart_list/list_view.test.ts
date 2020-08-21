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
    cy.server();
    cy.visit(CHART_LIST);
    cy.get('[data-test="list-view"]').click();
  });

  it.skip('should load rows', () => {
    cy.get('.chart-list-view');
    cy.get('table[role="table"]').should('be.visible');

    // check chart list view header
    cy.get('th[role="columnheader"]:nth-child(2)').contains('Chart');
    cy.get('th[role="columnheader"]:nth-child(3)').contains(
      'Visualization Type',
    );
    cy.get('th[role="columnheader"]:nth-child(4)').contains('Datasource');
    cy.get('th[role="columnheader"]:nth-child(5)').contains('Modified By');
    cy.get('th[role="columnheader"]:nth-child(6)').contains('Last Modified');
    cy.get('th[role="columnheader"]:nth-child(7)').contains('Actions');
    cy.get('.table-row').should('have.length', 25);
  });

  it('should sort correctly', () => {
    cy.get('th[role="columnheader"]:nth-child(2)').click();
    cy.get('.table-row td:nth-child(2):eq(0)').contains('% Rural');
  });
});
