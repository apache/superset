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

// eslint-disable-next-line import/no-extraneous-dependencies
import * as ace from 'brace';
import * as shortid from 'shortid';
import { WORLD_HEALTH_DASHBOARD } from './dashboard.helper';

function selectColorScheme(color: string) {
  // open color scheme dropdown
  cy.get('.ant-modal-body')
    .contains('Color scheme')
    .parents('.ControlHeader')
    .next('.ant-select')
    .click()
    .then($colorSelect => {
      // select a new color scheme
      cy.wrap($colorSelect).find(`[data-test="${color}"]`).click();
    });
}

function assertMetadata(text: string) {
  const regex = new RegExp(text);
  cy.get('.ant-modal-body')
    .find('#json_metadata')
    .should('be.visible')
    .then(() => {
      const metadata = cy.$$('#json_metadata')[0];

      // cypress can read this locally, but not in ci
      // so we have to use the ace module directly to fetch the value
      expect(ace.edit(metadata).getValue()).to.match(regex);
    });
}

function typeMetadata(text: string) {
  cy.get('.ant-modal-body')
    .find('#json_metadata')
    .should('be.visible')
    .type(text);
}

function openAdvancedProperties() {
  return cy
    .get('.ant-modal-body')
    .contains('Advanced')
    .should('be.visible')
    .click();
}

function openDashboardEditProperties() {
  // open dashboard properties edit modal
  cy.get('#save-dash-split-button').trigger('click', { force: true });
  cy.get('[data-test=header-actions-menu]')
    .contains('Edit dashboard properties')
    .click({ force: true });
}

describe('Dashboard edit action', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(WORLD_HEALTH_DASHBOARD);
    cy.intercept(`/api/v1/dashboard/1`).as('dashboardGet');
    cy.get('.dashboard-grid', { timeout: 50000 })
      .should('be.visible') // wait for 50 secs to load dashboard
      .then(() => {
        cy.get('.dashboard-header [aria-label=edit-alt]')
          .should('be.visible')
          .click();
        openDashboardEditProperties();
      });
  });

  it('should update the title', () => {
    const dashboardTitle = `Test dashboard [${shortid.generate()}]`;

    // update title
    cy.get('.ant-modal-body')
      .should('be.visible')
      .contains('Title')
      .get('[data-test="dashboard-title-input"]')
      .type(`{selectall}{backspace}${dashboardTitle}`);

    cy.wait('@dashboardGet').then(() => {
      selectColorScheme('d3Category20b');
    });

    // save edit changes
    cy.get('.ant-modal-footer')
      .contains('Apply')
      .click()
      .then(() => {
        // assert that modal edit window has closed
        cy.get('.ant-modal-body').should('not.exist');

        // assert title has been updated
        cy.get('.editable-title input').should('have.value', dashboardTitle);
      });
  });
  describe('the color picker is changed', () => {
    describe('the metadata has a color scheme', () => {
      describe('the advanced tab is open', () => {
        // TODO test passes locally but not on ci
        xit('should overwrite the color scheme', () => {
          openAdvancedProperties();
          cy.wait('@dashboardGet').then(() => {
            selectColorScheme('d3Category20b');
            assertMetadata('d3Category20b');
          });
        });
      });
      describe('the advanced tab is not open', () => {
        // TODO test passes locally but not on ci
        xit('should overwrite the color scheme', () => {
          selectColorScheme('bnbColors');
          openAdvancedProperties();
          cy.wait('@dashboardGet').then(() => {
            assertMetadata('bnbColors');
          });
        });
      });
    });
  });
  describe('a valid colorScheme is entered', () => {
    // TODO test passes locally but not on ci
    xit('should save json metadata color change to dropdown', () => {
      // edit json metadata
      openAdvancedProperties().then(() => {
        typeMetadata(
          '{selectall}{backspace}{{}"color_scheme":"d3Category20"{}}',
        );
      });

      // save edit changes
      cy.get('.modal-footer')
        .contains('Save')
        .click()
        .then(() => {
          // assert that modal edit window has closed
          cy.get('.ant-modal-body').should('not.exist');

          // assert color has been updated
          openDashboardEditProperties();
          openAdvancedProperties().then(() => {
            assertMetadata('d3Category20');
          });
          cy.get('.color-scheme-container').should(
            'have.attr',
            'data-test',
            'd3Category20',
          );
        });
    });
  });
  describe('an invalid colorScheme is entered', () => {
    // TODO test passes locally but not on ci
    xit('should throw an error', () => {
      // edit json metadata
      openAdvancedProperties().then(() => {
        typeMetadata(
          '{selectall}{backspace}{{}"color_scheme":"THIS_DOES_NOT_WORK"{}}',
        );
      });

      // save edit changes
      cy.get('.modal-footer')
        .contains('Save')
        .click()
        .then(() => {
          // assert that modal edit window has closed
          cy.get('.ant-modal-body')
            .contains('A valid color scheme is required')
            .should('be.visible');
        });

      cy.on('uncaught:exception', err => {
        expect(err.message).to.include('something about the error');

        // return false to prevent the error from
        // failing this test
        return false;
      });
    });
  });
});
