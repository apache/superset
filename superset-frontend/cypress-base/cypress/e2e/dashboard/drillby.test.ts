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
import { waitForChartLoad } from 'cypress/utils';
import { SUPPORTED_CHARTS_DASHBOARD } from 'cypress/utils/urls';
import { SUPPORTED_TIER1_CHARTS } from './utils';

const interceptV1ChartData = (alias = 'v1Data') => {
  cy.intercept('/api/v1/chart/data*').as(alias);
};

const interceptLegacyChartData = () => {
  cy.intercept('/superset/explore_json*').as('legacyData');
};

const interceptFormDataKey = () => {
  cy.intercept('/api/v1/explore/form_data').as('formDataKey');
};

const closeModal = () => {
  cy.get('body').then($body => {
    if ($body.find('[data-test="close-drill-by-modal"]').length) {
      cy.getBySel('close-drill-by-modal').click({ force: true });
    }
  });
};

const setTopLevelTab = (tabName: string) => {
  cy.get("div#TABS-TOP div[role='tab']").contains(tabName).click();
};

const openTableContextMenu = (
  cellContent: string,
  tableSelector = "[data-test-viz-type='table']",
) => {
  cy.get(tableSelector).scrollIntoView().contains(cellContent).rightclick();
};

const drillBy = (targetDrillByColumn: string, isLegacy = false) => {
  if (isLegacy) {
    interceptLegacyChartData();
  } else {
    interceptV1ChartData();
  }

  cy.get('.ant-dropdown')
    .not('.ant-dropdown-hidden')
    .first()
    .find("[role='menu'] [role='menuitem'] [title='Drill by']")
    .trigger('mouseover');
  cy.getBySel('loading-indicator').should('not.exist').wait(1000);
  cy.get('[data-test="drill-by-submenu"]')
    .not('.ant-dropdown-menu-hidden [data-test="drill-by-submenu"]')
    .find('[role="menuitem"]')
    .contains(new RegExp(`^${targetDrillByColumn}$`))
    .first()
    .click();

  if (isLegacy) {
    cy.wait('@legacyData');
  } else {
    cy.wait('@v1Data');
  }
};

describe('Drill by modal', () => {
  before(() => {
    cy.visit(SUPPORTED_CHARTS_DASHBOARD);
  });
  beforeEach(() => {
    closeModal();
  });

  describe('Modal actions', () => {
    before(() => {
      setTopLevelTab('Tier 1');
      SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
    });

    it('opens the modal from the context menu', () => {
      openTableContextMenu('boy');
      drillBy('state');

      cy.getBySel('"Drill by: Table-modal"').as('drillByModal');

      cy.get('@drillByModal')
        .find('.draggable-trigger')
        .should('contain', 'Drill by: Table');

      cy.get('@drillByModal')
        .find('[data-test="metadata-bar"]')
        .should('be.visible');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'state');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('contain', 'state')
        .and('contain', 'sum__num');

      // further drilling
      openTableContextMenu('CA', '[data-test="drill-by-chart"]');
      drillBy('name');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('not.contain', 'state')
        .and('contain', 'name')
        .and('contain', 'sum__num');

      // undo - back to drill by state
      interceptV1ChartData('drillByUndo');
      interceptFormDataKey();
      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('contain', 'state (CA)')
        .and('contain', 'name')
        .contains('state (CA)')
        .click();
      cy.wait('@drillByUndo');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-chart"]')
        .should('be.visible')
        .and('not.contain', 'name')
        .and('contain', 'state')
        .and('contain', 'sum__num');

      cy.get('@drillByModal')
        .find('.ant-breadcrumb')
        .should('be.visible')
        .and('contain', 'gender (boy)')
        .and('contain', '/')
        .and('not.contain', 'state (CA)')
        .and('not.contain', 'name')
        .and('contain', 'state');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-display-toggle"]')
        .contains('Table')
        .click();

      cy.getBySel('drill-by-chart').should('not.exist');

      cy.get('@drillByModal')
        .find('[data-test="drill-by-results-table"]')
        .should('be.visible');

      cy.wait('@formDataKey').then(intercept => {
        cy.get('@drillByModal')
          .contains('Edit chart')
          .should('have.attr', 'href')
          .and(
            'contain',
            `/explore/?form_data_key=${intercept.response?.body?.key}`,
          );
      });
    });
  });

  describe('Tier 1 charts', () => {
    before(() => {
      setTopLevelTab('Tier 1');
      SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
    });
  });
});
