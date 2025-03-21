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
import {
  SAMPLE_DASHBOARD_1,
  SUPPORTED_CHARTS_DASHBOARD,
  TABBED_DASHBOARD,
} from 'cypress/utils/urls';
import { drag, resize, waitForChartLoad } from 'cypress/utils';
import * as ace from 'brace';
import {
  interceptExploreUpdate,
  interceptGet,
  interceptUpdate,
  openTab,
} from './utils';
import {
  interceptExploreJson,
  interceptFiltering as interceptCharts,
} from '../explore/utils';

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
    cy.get('.ant-modal-body').should('be.visible');
  });
}

function openExploreProperties() {
  cy.getBySel('actions-trigger').click({ force: true });
  cy.get('.ant-dropdown-menu')
    .contains('Edit chart properties')
    .click({ force: true });
  cy.get('.ant-modal-body').should('be.visible');
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

function openAdvancedProperties() {
  cy.get('.ant-modal-body')
    .contains('Advanced')
    .should('be.visible')
    .click({ force: true });
  cy.get('#json_metadata').should('be.visible');
}

function dragComponent(
  component = 'Unicode Cloud',
  target = 'card-title',
  withFiltering = true,
) {
  if (withFiltering) {
    cy.getBySel('dashboard-charts-filter-search-input').type(component);
    cy.wait('@filtering');
  }
  cy.wait(500);
  drag(`[data-test="${target}"]`, component).to(
    '[data-test="grid-content"] [data-test="dragdroppable-object"]',
  );
}

function discardChanges() {
  cy.getBySel('undo-action').click({ force: true });
}

function visitEdit(sampleDashboard = SAMPLE_DASHBOARD_1) {
  interceptCharts();
  interceptGet();

  if (sampleDashboard === SAMPLE_DASHBOARD_1) {
    cy.createSampleDashboards([0]);
  }

  cy.visit(sampleDashboard);
  cy.wait('@get');
  editDashboard();
  cy.get('.grid-container').should('exist');
  cy.wait('@filtering');
  cy.wait(500);
}

function visit(sampleDashboard = SAMPLE_DASHBOARD_1) {
  interceptCharts();
  interceptGet();

  if (sampleDashboard === SAMPLE_DASHBOARD_1) {
    cy.createSampleDashboards([0]);
  }

  cy.visit(sampleDashboard);
  cy.wait('@get');
  cy.get('.grid-container').should('exist');
  cy.wait(500);
}

function resetDashboardColors(dashboard = 'tabbed_dash') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cy.getDashboard(dashboard).then((r: Record<string, any>) => {
    const jsonMetadata = r?.json_metadata || '{}';
    const metadata = JSON.parse(jsonMetadata);
    const resetMetadata = JSON.stringify({
      ...metadata,
      color_scheme: '',
      label_colors: {},
      shared_label_colors: [],
      map_label_colors: {},
    });
    cy.updateDashboard(r.id, {
      certification_details: r.certification_details,
      certified_by: r.certified_by,
      css: r.css,
      dashboard_title: r.dashboard_title,
      json_metadata: resetMetadata,
      owners: r.owners,
      slug: r.slug,
    });
  });
}

function selectColorScheme(
  color: string,
  target = 'dashboard-edit-properties-form',
) {
  cy.get(`[data-test="${target}"] input[aria-label="Select color scheme"]`)
    .first()
    .then($input => {
      cy.wrap($input).click({ force: true });
      cy.wrap($input).type(color.slice(0, 5), { force: true });
    });
  cy.getBySel(color).click({ force: true });
}

function saveAndGo(dashboard = 'Tabbed Dashboard') {
  interceptExploreUpdate();
  cy.getBySel('query-save-button').click();
  cy.getBySel('save-modal-body').then($modal => {
    cy.wrap($modal)
      .find("div[aria-label='Select a dashboard'] .ant-select-selection-item")
      .should('have.text', dashboard);
    cy.getBySel('save-overwrite-radio').should('not.be.disabled');
    cy.getBySel('save-overwrite-radio').click();
    cy.get('#btn_modal_save_goto_dash').click();
    cy.wait('@chartUpdate');
  });
}

function applyChanges() {
  cy.getBySel('properties-modal-apply-button').click({ force: true });
}

function saveChanges() {
  interceptUpdate();
  cy.getBySel('header-save-button').click({ force: true });
  cy.wait('@update');
}

function clearMetadata() {
  cy.get('#json_metadata').then($jsonmetadata => {
    cy.wrap($jsonmetadata).find('.ace_content').click({ force: true });
    cy.wrap($jsonmetadata)
      .find('.ace_text-input')
      .then($ace => {
        cy.wrap($ace).focus();
        cy.wrap($ace).should('have.focus');
        cy.wrap($ace).type('{selectall}', { force: true });
        cy.wrap($ace).type('{backspace}', { force: true });
      });
  });
}

function writeMetadata(metadata: string) {
  cy.get('#json_metadata').then($jsonmetadata => {
    cy.wrap($jsonmetadata).find('.ace_content').click({ force: true });
    cy.wrap($jsonmetadata)
      .find('.ace_text-input')
      .then($ace => {
        cy.wrap($ace).focus();
        cy.wrap($ace).should('have.focus');
        cy.wrap($ace).type(metadata, {
          parseSpecialCharSequences: false,
          force: true,
        });
      });
  });
}

function openExploreWithDashboardContext(chartName: string) {
  interceptExploreJson();
  interceptGet();

  cy.get(
    `[data-test-chart-name='${chartName}'] [aria-label='More Options']`,
  ).click();
  cy.get('.ant-dropdown')
    .not('.ant-dropdown-hidden')
    .find("[role='menu'] [role='menuitem']")
    .eq(2)
    .should('contain', 'Edit chart')
    .click();
  cy.wait('@getJson');
  cy.get('.chart-container').should('exist');
}

function saveExploreColorScheme(
  chart = 'Top 10 California Names Timeseries',
  colorScheme = 'supersetColors',
) {
  interceptExploreUpdate();
  openExploreWithDashboardContext(chart);
  openTab(0, 1, 'control-tabs');
  selectColorScheme(colorScheme, 'control-item');
  cy.getBySel('query-save-button').click();
  cy.getBySel('save-overwrite-radio').click();
  cy.getBySel('btn-modal-save').click();
  cy.wait('@chartUpdate');
}

describe('Dashboard edit', () => {
  describe('Color consistency', () => {
    beforeEach(() => {
      resetDashboardColors();
    });

    it('should not allow to change color scheme of a chart when dashboard has one', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      openTab(0, 1, 'control-tabs');

      cy.get('[aria-label="Select color scheme"]').should('be.disabled');
    });

    it('should not allow to change color scheme of a chart when dashboard has no scheme but chart has shared labels', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // open second top tab to catch shared labels
      openTab(0, 1);
      waitForChartLoad({
        name: 'Trends',
        viz: 'line',
      });

      openTab(0, 0);
      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      openTab(0, 1, 'control-tabs');

      cy.get('[aria-label="Select color scheme"]').should('be.disabled');
    });

    it('should allow to change color scheme of a chart when dashboard has no scheme but only custom label colors', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"","label_colors":{"Anthony":"red"}}');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      openTab(0, 1, 'control-tabs');
      selectColorScheme('blueToGreen', 'control-item');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      // label Christopher
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // label Daniel
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(0, 76, 218)');

      // label David
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .eq(3)
        .should('have.css', 'fill', 'rgb(0, 116, 241)');
    });

    it('should allow to change color scheme of a chart when dashboard has no scheme and show the change', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      openTab(0, 1, 'control-tabs');
      selectColorScheme('blueToGreen', 'control-item');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      saveAndGo();

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // reset original scheme
      saveExploreColorScheme();
    });

    it('should allow to change color scheme of a chart when dashboard has no scheme but custom label colors and show the change', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"","label_colors":{"Anthony":"red"}}');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      openTab(0, 1, 'control-tabs');
      selectColorScheme('blueToGreen', 'control-item');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      // label Christopher
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      saveAndGo();

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      // label Christopher
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // reset original scheme
      saveExploreColorScheme();
    });

    it('should not change colors on refreshes with no color scheme set', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(69, 78, 124)');

      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(69, 78, 124)');
    });

    it('should not change colors on refreshes with color scheme set', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(0, 76, 218)');

      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(0, 76, 218)');
    });

    it('should respect chart color scheme when none is set for the dashboard', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');
    });

    it('should apply same color to same labels with color scheme set on refresh', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      visit(TABBED_DASHBOARD);
      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });

    it('should apply same color to same labels with no color scheme set on refresh', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(31, 168, 201)');
    });

    it('custom label colors should take the precedence in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata(
        '{"color_scheme":"lyftColors","label_colors":{"Anthony":"red","Bangladesh":"red"}}',
      );
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      // open another nested tab
      openTab(2, 1);
      waitForChartLoad({ name: 'Growth Rate', viz: 'line' });
      cy.get('[data-test-chart-name="Growth Rate"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');
    });

    it('label colors should take the precedence for rendered charts in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      // open the tab first time and let chart load
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // go to previous tab
      openTab(1, 0);
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata(
        '{"color_scheme":"lyftColors","label_colors":{"Anthony":"red"}}',
      );
      applyChanges();
      saveChanges();

      // re-open the tab
      openTab(1, 1);
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');
    });

    it('should re-apply original color after removing custom label color with color scheme set', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata(
        '{"color_scheme":"lyftColors","label_colors":{"Anthony":"red"}}',
      );
      applyChanges();
      saveChanges();

      openTab(1, 1);
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      editDashboard();
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"lyftColors","label_colors":{}}');
      applyChanges();
      saveChanges();

      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(234, 11, 140)');
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .eq(1)
        .should('have.css', 'fill', 'rgb(108, 131, 142)');
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .eq(2)
        .should('have.css', 'fill', 'rgb(41, 171, 226)');
    });

    it('should re-apply original color after removing custom label color with no color scheme set', () => {
      visitEdit(TABBED_DASHBOARD);
      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .eq(1)
        .should('have.css', 'fill', 'rgb(69, 78, 124)');
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .eq(2)
        .should('have.css', 'fill', 'rgb(90, 193, 137)');

      openProperties();
      cy.get('[aria-label="Select color scheme"]').should('have.value', '');
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"","label_colors":{"Anthony":"red"}}');
      applyChanges();
      saveChanges();

      openTab(1, 1);
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      editDashboard();
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata('{"color_scheme":"","label_colors":{}}');
      applyChanges();
      saveChanges();

      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .eq(1)
        .should('have.css', 'fill', 'rgb(69, 78, 124)');
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .eq(2)
        .should('have.css', 'fill', 'rgb(90, 193, 137)');
    });

    it('should show the same colors in Explore', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      openAdvancedProperties();
      clearMetadata();
      writeMetadata(
        '{"color_scheme":"lyftColors","label_colors":{"Anthony":"red"}}',
      );
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');
    });

    it('should change color scheme multiple times', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      editDashboard();
      openProperties();
      selectColorScheme('modernSunset');
      applyChanges();
      saveChanges();

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(0, 128, 246)');

      // open main tab and nested tab
      openTab(0, 0);
      openTab(1, 1);

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(0, 128, 246)');
    });

    it('should apply the color scheme across main tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // go to second tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });

    it('should apply the color scheme across main tabs for rendered charts', () => {
      visitEdit(TABBED_DASHBOARD);
      waitForChartLoad({ name: 'Treemap', viz: 'treemap_v2' });
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // go to second tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'line' });

      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // change scheme now that charts are rendered across the main tabs
      editDashboard();
      openProperties();
      selectColorScheme('modernSunset');
      applyChanges();
      saveChanges();

      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(0, 128, 246)');
    });

    it('should apply the color scheme in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open another nested tab
      openTab(2, 1);
      waitForChartLoad({ name: 'Growth Rate', viz: 'line' });
      cy.get('[data-test-chart-name="Growth Rate"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });

    it('should apply a valid color scheme for rendered charts in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      // open the tab first time and let chart load
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'line',
      });

      // go to previous tab
      openTab(1, 0);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // re-open the tab
      openTab(1, 1);

      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });
  });

  describe('Edit properties', () => {
    before(() => {
      visitEdit();
    });

    beforeEach(() => {
      cy.createSampleDashboards([0]);
      openProperties();
      selectColorScheme('supersetColors');
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
      selectColorScheme('blueToGreen');
      openAdvancedProperties();
      assertMetadata('blueToGreen');
      applyChanges();
    });

    it('should overwrite the color scheme when advanced is open', () => {
      openAdvancedProperties();
      selectColorScheme('modernSunset');
      assertMetadata('modernSunset');
      applyChanges();
    });

    it('should not accept an invalid color scheme', () => {
      openAdvancedProperties();
      clearMetadata();
      // allow console error
      cy.allowConsoleErrors(['Error: A valid color scheme is required']);
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
      visitEdit();
    });

    beforeEach(() => {
      cy.createSampleDashboards([0]);
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
      cy.get('[role="checkbox"]').click();
      cy.getBySel('dashboard-charts-filter-search-input').type('Unicode');
      cy.wait('@filtering');
      cy.getBySel('chart-card')
        .should('have.length', 1)
        .contains('Unicode Cloud');
      cy.getBySel('dashboard-charts-filter-search-input').clear();
    });

    // TODO fix this test! This was the #1 flaky test as of 4/21/23 according to cypress dashboard.
    xit('should disable the Save button when undoing', () => {
      cy.get('[role="checkbox"]').click();
      dragComponent('Unicode Cloud', 'card-title', false);
      cy.getBySel('header-save-button').should('be.enabled');
      discardChanges();
      cy.getBySel('header-save-button').should('be.disabled');
    });
  });

  describe('Components', () => {
    beforeEach(() => {
      visitEdit();
    });

    it('should add charts', () => {
      cy.get('[role="checkbox"]').click();
      dragComponent();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
    });

    it.skip('should remove added charts', () => {
      cy.get('[role="checkbox"]').click();
      dragComponent('Unicode Cloud');
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
      cy.getBySel('dashboard-delete-component-button').click();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 0);
    });

    it.skip('should add markdown component to dashboard', () => {
      cy.getBySel('dashboard-builder-component-pane-tabs-navigation')
        .find('#tabs-tab-2')
        .click();

      // add new markdown component
      dragComponent('Text', 'new-component', false);

      cy.getBySel('dashboard-markdown-editor')
        .should(
          'have.text',
          '✨Header 1\n✨Header 2\n✨Header 3\n\nClick here to learn more about markdown formatting',
        )
        .click(10, 10);

      cy.getBySel('dashboard-component-chart-holder').contains(
        'Click here to learn more about [markdown formatting](https://bit.ly/1dQOfRK)',
      );

      cy.getBySel('dashboard-markdown-editor').click().type('Test resize');

      resize(
        '[data-test="dashboard-markdown-editor"] .resizable-container div.resizable-container-handle--bottom + div',
      ).to(500, 600);

      cy.getBySel('dashboard-markdown-editor').contains('Test resize');
    });
  });

  describe('Save', () => {
    beforeEach(() => {
      visitEdit();
    });

    it('should save', () => {
      cy.get('[role="checkbox"]').click();
      dragComponent();
      cy.getBySel('header-save-button').should('be.enabled');
      saveChanges();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
      cy.getBySel('edit-dashboard-button').should('be.visible');
    });
  });
});
