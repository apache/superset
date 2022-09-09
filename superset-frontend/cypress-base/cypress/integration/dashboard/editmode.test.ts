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
import { SAMPLE_DASHBOARD_1 } from 'cypress/utils/urls';
import { drag, resize } from 'cypress/utils';
import * as ace from 'brace';
import { interceptGet, interceptUpdate } from './utils';
import { interceptFiltering as interceptCharts } from '../explore/utils';

function editDashboard() {
  cy.getBySel('edit-dashboard-button').click();
}

function closeModal() {
  cy.getBySel('properties-modal-cancel-button').click({ force: true });
}

function openProperties() {
  cy.get('body').then($body => {
    if ($body.find('[data-test="properties-modal-cancel-button"]').length) {
      closeModal();
    }
    cy.getBySel('actions-trigger').click({ force: true });
    cy.getBySel('header-actions-menu')
      .contains('Edit properties')
      .click({ force: true });
    cy.wait(500);
  });
}

function openAdvancedProperties() {
  cy.get('.ant-modal-body')
    .contains('Advanced')
    .should('be.visible')
    .click({ force: true });
}

function dragComponent(component = 'Unicode Cloud', target = 'card-title') {
  drag(`[data-test="${target}"]`, component).to(
    '[data-test="grid-content"] [data-test="dragdroppable-object"]',
  );
}

function discardChanges() {
  cy.getBySel('undo-action').click({ force: true });
}

function visitEdit() {
  interceptCharts();
  interceptGet();

  cy.visit(SAMPLE_DASHBOARD_1);
  cy.wait('@get');
  editDashboard();
  cy.wait('@filtering');
  cy.wait(500);
}

function selectColorScheme(color: string) {
  cy.get(
    '[data-test="dashboard-edit-properties-form"] [aria-label="Select color scheme"]',
  )
    .first()
    .click();
  cy.getBySel(color).click();
}

function applyChanges() {
  cy.getBySel('properties-modal-apply-button').click();
}

function saveChanges() {
  interceptUpdate();
  cy.getBySel('header-save-button').click({ force: true });
  cy.wait('@update');
}

function assertMetadata(text: string) {
  const regex = new RegExp(text);
  cy.get('#json_metadata')
    .should('be.visible')
    .then(() => {
      const metadata = cy.$$('#json_metadata')[0];

      // cypress can read this locally, but not in ci
      // so we have to use the ace module directly to fetch the value
      expect(ace.edit(metadata).getValue()).to.match(regex);
    });
}
function clearMetadata() {
  cy.get('#json_metadata').then($jsonmetadata => {
    cy.wrap($jsonmetadata).type('{selectall} {backspace}');
  });
}

function writeMetadata(metadata: string) {
  cy.get('#json_metadata').then($jsonmetadata => {
    cy.wrap($jsonmetadata).type(metadata, { parseSpecialCharSequences: false });
  });
}

describe('Dashboard edit', () => {
  beforeEach(() => {
    cy.preserveLogin();
  });

  describe('Edit properties', () => {
    before(() => {
      cy.createSampleDashboards();
      visitEdit();
    });

    beforeEach(() => {
      openProperties();
    });

    it('should accept a valid color scheme', () => {
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"lyftColors"}');
      applyChanges();
      openProperties();
      openAdvancedProperties();
      assertMetadata('lyftColors');
      applyChanges();
    });

    it('should overwrite the color scheme when advanced is closed', () => {
      selectColorScheme('d3Category20b');
      openAdvancedProperties();
      assertMetadata('d3Category20b');
      applyChanges();
    });

    it('should overwrite the color scheme when advanced is open', () => {
      openAdvancedProperties();
      selectColorScheme('googleCategory10c');
      assertMetadata('googleCategory10c');
      applyChanges();
    });

    it('should not accept an invalid color scheme', () => {
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"wrongcolorscheme"}');
      applyChanges();
      cy.get('.ant-modal-body')
        .contains('A valid color scheme is required')
        .should('be.visible');
    });

    it('should edit the title', () => {
      cy.getBySel('dashboard-title-input').clear().type('Edited title');
      applyChanges();
      cy.getBySel('editable-title-input').should('have.value', 'Edited title');
    });
  });

  describe('Edit mode', () => {
    before(() => {
      cy.createSampleDashboards();
      visitEdit();
    });

    beforeEach(() => {
      discardChanges();
    });

    it('should enable edit mode', () => {
      cy.getBySel('dashboard-builder-sidepane').should('be.visible');
    });

    it('should edit the title inline', () => {
      cy.getBySel('editable-title-input').clear().type('Edited title{enter}');
      cy.getBySel('header-save-button').should('be.enabled');
    });

    it('should filter charts', () => {
      interceptCharts();
      cy.getBySel('dashboard-charts-filter-search-input').type('Unicode');
      cy.wait('@filtering');
      cy.getBySel('chart-card')
        .should('have.length', 1)
        .contains('Unicode Cloud');
      cy.getBySel('dashboard-charts-filter-search-input').clear();
    });

    it('should disable the Save button when undoing', () => {
      dragComponent();
      cy.getBySel('header-save-button').should('be.enabled');
      discardChanges();
      cy.getBySel('header-save-button').should('be.disabled');
    });
  });

  describe('Components', () => {
    before(() => {
      cy.createSampleDashboards();
    });

    beforeEach(() => {
      visitEdit();
    });

    it('should add charts', () => {
      dragComponent();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
    });

    it('should remove added charts', () => {
      dragComponent('Pivot Table');
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
      cy.getBySel('dashboard-delete-component-button').click();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 0);
    });

    it('should add markdown component to dashboard', () => {
      cy.getBySel('dashboard-builder-component-pane-tabs-navigation')
        .find('#tabs-tab-2')
        .click();

      // add new markdown component
      dragComponent('Markdown', 'new-component');

      cy.get('[data-test="dashboard-markdown-editor"]')
        .should(
          'have.text',
          '✨Markdown✨Markdown✨MarkdownClick here to edit markdown',
        )
        .click();

      cy.getBySel('dashboard-component-chart-holder').contains(
        'Click here to edit [markdown](https://bit.ly/1dQOfRK)',
      );

      cy.getBySel('dashboard-markdown-editor').click().type('Test resize');

      resize(
        '[data-test="dashboard-markdown-editor"] .resizable-container span div:last-child',
      ).to(500, 600);

      cy.getBySel('dashboard-markdown-editor').contains('Test resize');
    });
  });

  describe('Color schemes', () => {
    beforeEach(() => {
      cy.createSampleDashboards();
      visitEdit();
    });

    it('should apply a valid color scheme', () => {
      dragComponent('Top 10 California Names Timeseries');
      openProperties();
      selectColorScheme('lyftColors');
      applyChanges();
      saveChanges();
      cy.get('.line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(234, 11, 140)');
    });

    it('label colors should take the precedence', () => {
      dragComponent('Top 10 California Names Timeseries');
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata(
        '{"color_scheme":"lyftColors","label_colors":{"Anthony":"red"}}',
      );
      applyChanges();
      saveChanges();
      cy.get('.line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');
    });
  });

  describe('Save', () => {
    beforeEach(() => {
      cy.createSampleDashboards();
      visitEdit();
    });

    it('should save', () => {
      dragComponent();
      cy.getBySel('header-save-button').should('be.enabled');
      saveChanges();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
      cy.getBySel('edit-dashboard-button').should('be.visible');
    });
  });
});
