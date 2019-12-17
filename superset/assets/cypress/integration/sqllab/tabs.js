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
export default () => {
  describe('SqlLab query tabs', () => {
    beforeEach(() => {
      cy.login();
      cy.server();
      cy.visit('/superset/sqllab');
    });

    it('allows you to create a tab', () => {
      cy.get('#a11y-query-editor-tabs > ul > li').then(tabList => {
        const initialTabCount = tabList.length;

        // add tab
        cy.get('#a11y-query-editor-tabs > ul > li')
          .last()
          .click();

        cy.get('#a11y-query-editor-tabs > ul > li').should(
          'have.length',
          initialTabCount + 1,
        );
      });
    });

    it('allows you to close a tab', () => {
      cy.get('#a11y-query-editor-tabs > ul > li').then(tabListA => {
        const initialTabCount = tabListA.length;

        // open the tab dropdown to remove
        cy.get(
          '#a11y-query-editor-tabs > ul > li:first button:nth-child(2)',
        ).click();

        // first item is close
        cy.get('#a11y-query-editor-tabs > ul > li:first ul li a')
          .eq(0)
          .click();

        cy.get('#a11y-query-editor-tabs > ul > li').should(
          'have.length',
          initialTabCount - 1,
        );
      });
    });
  });
};
