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
import { SUPPORTED_TIER1_CHARTS, SUPPORTED_TIER2_CHARTS } from './utils';

function interceptSamples() {
  cy.intercept(`/datasource/samples*`).as('samples');
}

function openModalFromMenu(chartType: string) {
  interceptSamples();

  cy.get(
    `[data-test-viz-type='${chartType}'] [aria-label='More Options']`,
  ).click();
  cy.get('.ant-dropdown')
    .not('.ant-dropdown-hidden')
    .find("[role='menu'] [role='menuitem']")
    .eq(5)
    .should('contain', 'Drill to detail')
    .click();
  cy.wait('@samples');
}

function openModalFromChartContext(targetMenuItem: string) {
  interceptSamples();

  cy.get('.ant-dropdown')
    .not('.ant-dropdown-hidden')
    .find("[role='menu'] [role='menuitem']")
    .should('contain', targetMenuItem)
    .click();
  cy.wait('@samples');
}

function closeModal() {
  cy.get('body').then($body => {
    if ($body.find('[data-test="close-drilltodetail-modal"]').length) {
      cy.getBySel('close-drilltodetail-modal').click({ force: true });
    }
  });
}

function setTopLevelTab(tabName: string) {
  cy.get("div#TABS-TOP div[role='tab']").contains(tabName).click();
}

describe('Drill to detail modal', () => {
  beforeEach(() => {
    cy.preserveLogin();
    closeModal();
  });

  describe('Tier 1 charts', () => {
    before(() => {
      cy.visit(SUPPORTED_CHARTS_DASHBOARD);
      setTopLevelTab('Tier 1');
      SUPPORTED_TIER1_CHARTS.forEach(waitForChartLoad);
    });

    describe('Modal actions', () => {
      it('opens the modal from the context menu', () => {
        openModalFromMenu('big_number_total');

        cy.get("[role='dialog'] .draggable-trigger").should(
          'contain',
          'Drill to detail: Big Number',
        );
      });

      it('refreshes the data', () => {
        openModalFromMenu('big_number_total');
        // move to the last page
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .eq(7)
          .click();
        cy.wait('@samples');
        // reload
        cy.get("[aria-label='reload']").click();
        cy.wait('@samples');
        // make sure it started back from first page
        cy.get(".pagination-container [role='navigation'] li.active").should(
          'contain',
          '1',
        );
      });

      it('paginates', () => {
        openModalFromMenu('big_number_total');
        // checking the data
        cy.getBySel('row-count-label').should('contain', '75.7k rows');
        cy.get(".ant-modal-body [role='rowgroup'] [role='row']")
          .should('have.length', 50)
          .then($rows => {
            expect($rows).to.contain('Amy');
          });
        // checking the paginated data
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .should('have.length', 9)
          .then($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('1514');
          });
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .eq(7)
          .click();
        cy.wait('@samples');
        cy.get("[role='rowgroup'] [role='row']")
          .should('have.length', 43)
          .then($rows => {
            expect($rows).to.contain('Victoria');
          });
      });
    });

    describe('Time-series Bar Chart V2', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        cy.get("[data-test-viz-type='echarts_timeseries_bar'] canvas").then(
          $canvas => {
            cy.wrap($canvas)
              .scrollIntoView()
              .rightclick(70, 100, { force: true });
            cy.get('.ant-dropdown')
              .not('.ant-dropdown-hidden')
              .find("[role='menu'] [role='menuitem']")
              .should('have.length', 3)
              .then($menuitems => {
                expect($menuitems).to.contain('Drill to detail by 1965');
                expect($menuitems).to.contain('Drill to detail by boy');
                expect($menuitems).to.contain('Drill to detail by all');
              })
              .eq(2)
              .click();
            cy.wait('@samples');

            cy.getBySel('filter-val').then($filters => {
              expect($filters).to.contain('1965');
              expect($filters).to.contain('boy');
            });
          },
        );
      });
    });

    describe('Pie', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        // opens the modal by clicking on the slice of the Pie chart
        cy.get("[data-test-viz-type='pie'] canvas").then($canvas => {
          const canvasWidth = $canvas.width() || 0;
          const canvasHeight = $canvas.height() || 0;
          const canvasCenterX = canvasWidth / 3;
          const canvasCenterY = canvasHeight / 2;

          cy.wrap($canvas)
            .scrollIntoView()
            .rightclick(canvasCenterX, canvasCenterY, { force: true });

          openModalFromChartContext('Drill to detail by girl');

          // checking the filtered and paginated data
          cy.getBySel('filter-val').should('contain', 'girl');
        });
      });
    });

    describe('Big number total', () => {
      it('opens the modal with no filters', () => {
        interceptSamples();

        // opens the modal by clicking on the number on the chart
        cy.get("[data-test-viz-type='big_number_total'] .header-line")
          .scrollIntoView()
          .rightclick();

        openModalFromChartContext('Drill to detail');

        cy.getBySel('filter-val').should('not.exist');
      });
    });

    describe('Big number with trendline', () => {
      it('opens the modal with the correct data', () => {
        interceptSamples();

        // opens the modal by clicking on the number
        cy.get("[data-test-viz-type='big_number'] .header-line")
          .scrollIntoView()
          .rightclick();

        openModalFromChartContext('Drill to detail');

        cy.getBySel('filter-val').should('not.exist');

        // TODO: test clicking on a trendline
        // Cypress is refusing to rightclick on the dot
      });
    });
  });

  describe('Tier 2 charts', () => {
    before(() => {
      cy.visit(SUPPORTED_CHARTS_DASHBOARD);
      setTopLevelTab('Tier 2');
      SUPPORTED_TIER2_CHARTS.forEach(waitForChartLoad);
    });

    describe('Modal actions', () => {
      it('clears filters', () => {
        interceptSamples();

        // opens the modal by clicking on the box on the chart
        cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
          const canvasWidth = $canvas.width() || 0;
          const canvasHeight = $canvas.height() || 0;
          const canvasCenterX = canvasWidth / 3;
          const canvasCenterY = (canvasHeight * 5) / 6;

          cy.wrap($canvas)
            .scrollIntoView()
            .rightclick(canvasCenterX, canvasCenterY, { force: true });

          openModalFromChartContext('Drill to detail by boy');

          // checking the filter
          cy.getBySel('filter-val').should('contain', 'boy');
          cy.getBySel('row-count-label').should('contain', '39.2k rows');
          cy.get(".pagination-container [role='navigation'] [role='button']")
            .should('have.length', 9)
            .then($pages => {
              expect($pages).to.contain('1');
              expect($pages).to.contain('785');
            });

          // close the filter and test that data was reloaded
          cy.getBySel('filter-col').find("[aria-label='close']").click();
          cy.wait('@samples');
          cy.getBySel('row-count-label').should('contain', '75.7k rows');
          cy.get(".pagination-container [role='navigation'] li.active").should(
            'contain',
            '1',
          );
          cy.get(".pagination-container [role='navigation'] [role='button']")
            .should('have.length', 9)
            .then($pages => {
              expect($pages).to.contain('1');
              expect($pages).to.contain('1514');
            });
        });
      });
    });

    describe('Box plot', () => {
      it('opens the modal with the correct filters', () => {
        interceptSamples();

        // opens the modal by clicking on the box on the chart
        cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
          const canvasWidth = $canvas.width() || 0;
          const canvasHeight = $canvas.height() || 0;
          const canvasCenterX = canvasWidth / 3;
          const canvasCenterY = (canvasHeight * 5) / 6;

          cy.wrap($canvas)
            .scrollIntoView()
            .rightclick(canvasCenterX, canvasCenterY, { force: true });

          openModalFromChartContext('Drill to detail by boy');

          // checking the filter
          cy.getBySel('filter-val').should('contain', 'boy');
        });
      });
    });
  });
});
