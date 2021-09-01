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

const cleanup = cleanupString => {
  // cleanup
  cy.get('span[data-test="span-modal-trigger"]')
    .find('div[role="button"]')
    .contains('Parameters')
    .click();
  cy.get('.ant-modal .ace_content').click().type(cleanupString);
  cy.get('.ant-modal-close-x').click();
  cy.get('.ant-modal').find('.ace-content').should('not.exist');
};

describe('SqlLab parameters', () => {
  beforeEach(() => {
    cy.login();
    cy.visit('/superset/sqllab');
  });

  it('should allow editing parameters', () => {
    // open modal and add in new content
    cy.get('.sql-toolbar span[aria-label="more-horiz"]').click();
    cy.get('div[role="button"]').contains('Parameters').click();
    cy.get('.ant-modal .ace_content').click().type('{leftarrow}"foo":2');
    cy.get('.ant-modal-close-x').click();
    cy.get('.ant-modal').find('.ace-content').should('not.exist');

    // check that there are no alerts or warnings
    cy.get('.sql-toolbar span[aria-label="more-horiz"]').click();
    cy.get('div[role="button"]')
      .contains('Parameters')
      .within(() => {
        cy.get('i.text-danger').should('not.exist');
        cy.get('.ant-scroll-number-only-unit.current')
          .contains('1')
          .should('be.visible');
      });
    cleanup(
      '{leftarrow}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}{backspace}',
    );
  });

  it('should show an error if the json is incorrect', () => {
    // open modal and add in new content
    cy.get('.sql-toolbar span[aria-label="more-horiz"]').click();
    cy.get('div[role="button"]').contains('Parameters').click();
    cy.get('.ant-modal .ace_content').click().type('{leftarrow}foo:2');
    cy.get('.ant-modal-close-x').click();
    cy.get('.ant-modal').find('.ace-content').should('not.exist');

    // check that an alert exists
    cy.get('.sql-toolbar span[aria-label="more-horiz"]').click();
    cy.get('div[role="button"]')
      .contains('Parameters')
      .within(() => {
        cy.get('i.text-danger').should('be.visible');
        cy.get('.ant-scroll-number-only-unit.current').should('not.exist');
      });
    // cleanup
    cleanup(
      '{leftarrow}{backspace}{backspace}{backspace}{backspace}{backspace}',
    );
  });
});
