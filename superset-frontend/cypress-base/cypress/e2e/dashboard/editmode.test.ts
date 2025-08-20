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
import { SAMPLE_DASHBOARD_1, TABBED_DASHBOARD } from 'cypress/utils/urls';
import {
  drag,
  resize,
  setSelectSearchInput,
  waitForChartLoad,
} from 'cypress/utils';
import { edit } from 'brace';
import {
  interceptExploreUpdate,
  interceptGet,
  interceptUpdate,
  openTab,
} from './utils';
import {
  interceptV1ChartData,
  interceptFiltering as interceptCharts,
} from '../explore/utils';

function editDashboard() {
  cy.getBySel('edit-dashboard-button').click();
}

function openProperties() {
  cy.getBySel('actions-trigger').click({ force: true });
  cy.getBySel('header-actions-menu')
    .contains('Edit properties')
    .click({ force: true });
  cy.get('.ant-modal-body').should('be.visible');
}

function assertMetadata(text: string) {
  const regex = new RegExp(text);
  // Ensure the JSON metadata editor exists and is in view
  cy.get('#json_metadata').should('exist');
  cy.get('#json_metadata').scrollIntoView({ offset: { top: -100, left: 0 } });
  cy.wait(200); // Small wait for scroll

  cy.get('#json_metadata')
    .should('exist')
    .then(() => {
      const metadata = cy.$$('#json_metadata')[0];

      // cypress can read this locally, but not in ci
      // so we have to use the ace module directly to fetch the value
      expect(edit(metadata).getValue()).to.match(regex);
    });
}

function openAdvancedProperties() {
  // Scroll to Advanced Settings section first since modal content is scrollable
  cy.get('.ant-modal-body').contains('Advanced Settings').scrollIntoView();
  cy.get('.ant-modal-body')
    .contains('Advanced Settings')
    .should('be.visible')
    .click({ force: true });

  // Wait for the section to expand and the JSON metadata editor to be in DOM
  cy.get('#json_metadata').should('exist');

  // Scroll the JSON metadata editor into view within the modal body
  cy.get('#json_metadata').scrollIntoView({ offset: { top: -100, left: 0 } });

  // Wait a bit for the scroll to complete and element to be positioned
  cy.wait(500);

  // Check that it exists rather than visible due to CSS overflow issues
  cy.get('#json_metadata').should('exist');
}

function dragComponent(
  component = 'Unicode Cloud',
  target = 'card-title',
  withFiltering = true,
) {
  if (withFiltering) {
    cy.getBySel('dashboard-charts-filter-search-input').type(component, {
      force: true,
    });
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
  // First, expand the Styling section if it's collapsed
  cy.get(`[data-test="${target}"]`).within(() => {
    // Find the Collapse header that contains "Styling" text
    cy.contains('Styling').scrollIntoView();
    cy.contains('Styling')
      .closest('.ant-collapse-header')
      .then($header => {
        // Click to expand regardless of current state
        cy.wrap($header).click({ force: true });
      });

    // Wait for animation and verify section is expanded
    cy.contains('Styling')
      .closest('.ant-collapse-header')
      .should('have.attr', 'aria-expanded', 'true');
    cy.wait(500); // Extra wait for content to render

    // Ensure the color scheme input is visible before proceeding
    cy.get('input[aria-label="Select color scheme"]').should('be.visible');
  });

  // Now select the color scheme
  cy.get(`[data-test="${target}"] input[aria-label="Select color scheme"]`)
    .should('exist')
    .then($input => {
      setSelectSearchInput($input, color.slice(0, 5));
    });
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
  cy.getBySel('modal-confirm-button').click({ force: true });
  // Wait for modal to close completely
  cy.get('.ant-modal-wrap').should('not.exist');
}

function saveChanges() {
  interceptUpdate();
  cy.getBySel('header-save-button').click({ force: true });
  cy.wait('@update');
}

function clearMetadata() {
  // Ensure the JSON metadata editor exists and scroll it into view
  cy.get('#json_metadata').should('exist');
  cy.get('#json_metadata').scrollIntoView({ offset: { top: -100, left: 0 } });
  cy.wait(200); // Small wait for scroll

  cy.get('#json_metadata').then($jsonmetadata => {
    cy.wrap($jsonmetadata).find('.ace_content').click({ force: true });
    cy.wrap($jsonmetadata)
      .find('.ace_text-input')
      .then($ace => {
        cy.wrap($ace).focus();
        cy.wrap($ace).type('{selectall}', { force: true });
        cy.wrap($ace).type('{backspace}', { force: true });
      });
  });
}

function writeMetadata(metadata: string) {
  // Ensure the JSON metadata editor exists and scroll it into view
  cy.get('#json_metadata').should('exist');
  cy.get('#json_metadata').scrollIntoView({ offset: { top: -100, left: 0 } });
  cy.wait(200); // Small wait for scroll

  cy.get('#json_metadata').then($jsonmetadata => {
    cy.wrap($jsonmetadata).find('.ace_content').click({ force: true });
    cy.wrap($jsonmetadata)
      .find('.ace_text-input')
      .then($ace => {
        cy.wrap($ace).focus();
        cy.wrap($ace).type(metadata, {
          parseSpecialCharSequences: false,
          force: true,
        });
      });
  });
}

function openExploreWithDashboardContext(chartName: string) {
  interceptV1ChartData();
  interceptGet();

  cy.get(
    `[data-test-chart-name='${chartName}'] [aria-label='More Options']`,
  ).click();
  cy.get(`[data-test-edit-chart-name='${chartName}']`)
    .should('be.visible')
    .trigger('keydown', {
      keyCode: 13,
      which: 13,
      force: true,
    });
  cy.wait('@v1Data');
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

// FIXME: Skipping some tests as ECharts are rendered using Canvas and we cannot inspect the elements
// to verify the colors. We should revisit these tests once we have a solution to verify ECharts.

describe('Dashboard edit', () => {
  describe('Color consistency', () => {
    beforeEach(() => {
      resetDashboardColors();
    });

    it.skip('should not allow to change color scheme of a chart when dashboard has one', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // hover over canvas elements
      cy.get('canvas').trigger('mouseover', { force: true });

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      openTab(0, 1, 'control-tabs');

      // Expand Styling section first
      cy.contains('Styling').scrollIntoView();
      cy.contains('Styling').closest('.ant-collapse-header').click();
      cy.get('[aria-label="Select color scheme"]').should('be.disabled');
    });

    it.skip('should not allow to change color scheme of a chart when dashboard has no scheme but chart has shared labels', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // open second top tab to catch shared labels
      openTab(0, 1);
      waitForChartLoad({
        name: 'Trends',
        viz: 'echarts_timeseries_line',
      });

      openTab(0, 0);
      openExploreWithDashboardContext('Top 10 California Names Timeseries');

      // label Anthony
      cy.get('[data-test="chart-container"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      openTab(0, 1, 'control-tabs');

      // Expand Styling section first
      cy.contains('Styling').scrollIntoView();
      cy.contains('Styling').closest('.ant-collapse-header').click();
      cy.get('[aria-label="Select color scheme"]').should('be.disabled');
    });

    it.skip('should allow to change color scheme of a chart when dashboard has no scheme but only custom label colors', () => {
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
        viz: 'echarts_timeseries_line',
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

    it.skip('should allow to change color scheme of a chart when dashboard has no scheme and show the change', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
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

    it.skip('should allow to change color scheme of a chart when dashboard has no scheme but custom label colors and show the change', () => {
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
        viz: 'echarts_timeseries_line',
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

    it.skip('should not change colors on refreshes with no color scheme set', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(69, 78, 124)');

      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(69, 78, 124)');
    });

    it.skip('should not change colors on refreshes with color scheme set', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(0, 76, 218)');

      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Andrew
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(1)
        .should('have.css', 'fill', 'rgb(0, 76, 218)');
    });

    it.skip('should respect chart color scheme when none is set for the dashboard', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');
    });

    it.skip('should apply same color to same labels with color scheme set on refresh', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      visit(TABBED_DASHBOARD);
      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });

    it.skip('should apply same color to same labels with no color scheme set on refresh', () => {
      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      visit(TABBED_DASHBOARD);

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(31, 168, 201)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      // label Anthony
      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .eq(2)
        .should('have.css', 'fill', 'rgb(31, 168, 201)');
    });

    it.skip('custom label colors should take the precedence in nested tabs', () => {
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
        viz: 'echarts_timeseries_line',
      });
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');

      // open another nested tab
      openTab(2, 1);
      waitForChartLoad({ name: 'Growth Rate', viz: 'echarts_timeseries_line' });
      cy.get('[data-test-chart-name="Growth Rate"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(255, 0, 0)');
    });

    it.skip('label colors should take the precedence for rendered charts in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      // open the tab first time and let chart load
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
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

    it.skip('should re-apply original color after removing custom label color with color scheme set', () => {
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

    it.skip('should re-apply original color after removing custom label color with no color scheme set', () => {
      visitEdit(TABBED_DASHBOARD);
      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
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
      // Expand Styling section first
      cy.contains('Styling').scrollIntoView();
      cy.contains('Styling').closest('.ant-collapse-header').click();
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

    it.skip('should show the same colors in Explore', () => {
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
        viz: 'echarts_timeseries_line',
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

    it.skip('should change color scheme multiple times', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });

      // label Anthony
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open 2nd main tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

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

    it.skip('should apply the color scheme across main tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // go to second tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

      cy.get('[data-test-chart-name="Trends"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });

    it.skip('should apply the color scheme across main tabs for rendered charts', () => {
      visitEdit(TABBED_DASHBOARD);
      waitForChartLoad({ name: 'Treemap', viz: 'treemap_v2' });
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // go to second tab
      openTab(0, 1);
      waitForChartLoad({ name: 'Trends', viz: 'echarts_timeseries_line' });

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

    it.skip('should apply the color scheme in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      openProperties();
      selectColorScheme('blueToGreen');
      applyChanges();
      saveChanges();

      // open nested tab
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
      });
      cy.get(
        '[data-test-chart-name="Top 10 California Names Timeseries"] .line .nv-legend-symbol',
      )
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');

      // open another nested tab
      openTab(2, 1);
      waitForChartLoad({ name: 'Growth Rate', viz: 'echarts_timeseries_line' });
      cy.get('[data-test-chart-name="Growth Rate"] .line .nv-legend-symbol')
        .first()
        .should('have.css', 'fill', 'rgb(50, 0, 167)');
    });

    it.skip('should apply a valid color scheme for rendered charts in nested tabs', () => {
      visitEdit(TABBED_DASHBOARD);
      // open the tab first time and let chart load
      openTab(1, 1);
      waitForChartLoad({
        name: 'Top 10 California Names Timeseries',
        viz: 'echarts_timeseries_line',
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

  // NOTE: Edit properties modal functionality is now covered by comprehensive Jest tests
  // in src/dashboard/components/PropertiesModal/PropertiesModal.test.tsx
  // This removes flaky Cypress modal interaction tests in favor of reliable unit tests

  // NOTE: Edit mode functionality is now covered by Jest integration tests
  // These tests were consistently failing due to modal overlay issues in Cypress
  // The core functionality is better tested with reliable unit/integration tests

  // NOTE: Chart drag/drop functionality requires true E2E testing
  // Keeping minimal Cypress tests for drag/drop workflows only
  describe('Components', () => {
    beforeEach(() => {
      visitEdit();
    });

    it('should add charts', () => {
      // Force close any modal that might be open
      cy.get('body').then($body => {
        if ($body.find('.ant-modal-wrap').length > 0) {
          cy.get('body').type('{esc}', { force: true });
          cy.wait(1000);
          // If ESC doesn't work, try clicking the close button
          cy.get('.ant-modal-close').click({ force: true });
          cy.wait(500);
        }
      });

      cy.get('input[type="checkbox"]').scrollIntoView();
      cy.get('input[type="checkbox"]').click({ force: true });
      dragComponent();
      cy.getBySel('dashboard-component-chart-holder').should('have.length', 1);
    });

    it.skip('should remove added charts', () => {
      cy.get('input[type="checkbox"]').scrollIntoView();
      cy.get('input[type="checkbox"]').click({ force: true });
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

      cy.getBySel('dashboard-markdown-editor').click();
      cy.getBySel('dashboard-markdown-editor').type('Test resize');

      resize(
        '[data-test="dashboard-markdown-editor"] .resizable-container div.resizable-container-handle--bottom + div',
      ).to(500, 600);

      cy.getBySel('dashboard-markdown-editor').contains('Test resize');
    });
  });

  // NOTE: Save functionality is now covered by Jest integration tests
  // This eliminates flaky modal overlay issues while ensuring save workflow is tested
});
