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
import { TABBED_DASHBOARD, drag } from './dashboard.helper';

describe('Dashboard edit markdown', () => {
  beforeEach(() => {
    cy.server();
    cy.login();
    cy.visit(TABBED_DASHBOARD);
  });

  it('should load AceEditor on demand', () => {
    let numScripts = 0;
    cy.get('script').then(nodes => {
      numScripts = nodes.length;
    });
    cy.get('.dashboard-header [data-test=pencil]').click();
    cy.get('script').then(nodes => {
      // load 5 new script chunks for css editor
      expect(nodes.length).to.greaterThan(numScripts);
      numScripts = nodes.length;
    });

    // add new markdown component
    drag('.new-component', 'Markdown').to(
      '.grid-row.background--transparent:first',
    );
    cy.get('script').then(nodes => {
      // load more scripts for markdown editor
      expect(nodes.length).to.greaterThan(numScripts);
      numScripts = nodes.length;
    });

    cy.contains('h3', '✨Markdown').click();
    cy.get('.ace_content').contains(
      'Click here to edit [markdown](https://bit.ly/1dQOfRK)',
    );

    // entering edit mode does not add new scripts
    // (though scripts may still be removed by others)
    cy.get('script').then(nodes => {
      expect(nodes.length).to.most(numScripts);
    });

    cy.get('.grid-row.background--transparent:first').click('right');
    cy.get('.ace_content').should('not.exist');
  });
});
