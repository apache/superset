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
import { ECHARTS_DASHBOARD } from 'cypress/utils/urls';
import { ECHARTS_CHARTS } from './utils';

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

describe('Drill to detail modal', () => {
  before(() => {
    cy.visit(ECHARTS_DASHBOARD);
    ECHARTS_CHARTS.forEach(waitForChartLoad);
  });

  beforeEach(() => {
    cy.preserveLogin();
    closeModal();
  });

  describe('Modal actions', () => {
    it('opens the modal from the context menu', () => {
      openModalFromMenu('big_number_total');

      cy.get("[role='dialog'] .draggable-trigger").should(
        'contain',
        'Drill to detail: Number of Girls',
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
      cy.getBySel('row-count-label').should('contain', '36.4k rows');
      cy.get("[role='rowgroup'] [role='row']")
        .should('have.length', 50)
        .then($rows => {
          expect($rows).to.contain('Amy');
        });
      // checking the paginated data
      cy.get(".pagination-container [role='navigation'] [role='button']")
        .should('have.length', 9)
        .then($pages => {
          expect($pages).to.contain('1');
          expect($pages).to.contain('729');
        });
      cy.get(".pagination-container [role='navigation'] [role='button']")
        .eq(7)
        .click();
      cy.wait('@samples');
      cy.get("[role='rowgroup'] [role='row']")
        .should('have.length', 46)
        .then($rows => {
          expect($rows).to.contain('Victoria');
        });
    });

    it('clears filters', () => {
      interceptSamples();

      // opens the modal by clicking on the box on the chart
      cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
        const canvasWidth = $canvas.width() || 0;
        const canvasHeight = $canvas.height() || 0;
        const canvasCenterX = canvasWidth / 6;
        const canvasCenterY = canvasHeight / 6;

        cy.wrap($canvas)
          .scrollIntoView()
          .rightclick(canvasCenterX, canvasCenterY, { force: true });

        openModalFromChartContext('Drill to detail by East Asia & Pacific');

        // checking the filter
        cy.getBySel('filter-val').should('contain', 'East Asia & Pacific');
        cy.getBySel('row-count-label').should('contain', '1.98k rows');
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .should('have.length', 9)
          .then($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('40');
          });

        // close the filter and test that data was reloaded
        cy.getBySel('filter-col').find("[aria-label='close']").click();
        cy.wait('@samples');
        cy.getBySel('row-count-label').should('contain', '11.8k rows');
        cy.get(".pagination-container [role='navigation'] li.active").should(
          'contain',
          '1',
        );
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .should('have.length', 9)
          .then($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('236');
          });
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

  describe('Box plot', () => {
    it('opens the modal with the correct filters', () => {
      interceptSamples();

      // opens the modal by clicking on the box on the chart
      cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
        const canvasWidth = $canvas.width() || 0;
        const canvasHeight = $canvas.height() || 0;
        const canvasCenterX = canvasWidth / 6;
        const canvasCenterY = canvasHeight / 6;

        cy.wrap($canvas)
          .scrollIntoView()
          .rightclick(canvasCenterX, canvasCenterY, { force: true });

        openModalFromChartContext('Drill to detail by East Asia & Pacific');

        // checking the filter
        cy.getBySel('filter-val').should('contain', 'East Asia & Pacific');
      });
    });
  });

  describe('Pie', () => {
    it('opens the modal with the correct filters', () => {
      interceptSamples();

      // opens the modal by clicking on the slice of the Pie chart
      cy.get("[data-test-viz-type='pie'] canvas").then($canvas => {
        const canvasWidth = $canvas.width() || 0;
        const canvasHeight = $canvas.height() || 0;
        const canvasCenterX = canvasWidth / 2;
        const canvasCenterY = canvasHeight / 2;

        cy.wrap($canvas)
          .scrollIntoView()
          .rightclick(canvasCenterX, canvasCenterY, { force: true });

        openModalFromChartContext('Drill to detail by boy');

        // checking the filtered and paginated data
        cy.getBySel('filter-val').should('contain', 'boy');
      });
    });
  });

  describe('Big number total', () => {
    it('opens the modal with no filters', () => {
      interceptSamples();

      // opens the modal by clicking on the number on the chart
      cy.get(
        "[data-test-viz-type='big_number_total'] .header-line",
      ).rightclick();

      openModalFromChartContext('Drill to detail');

      cy.getBySel('filter-val').should('not.exist');
    });
  });

  describe('Big number with trendline', () => {
    it('opens the modal with the correct data', () => {
      interceptSamples();

      // opens the modal by clicking on the number
      cy.get("[data-test-viz-type='big_number'] .header-line").rightclick();

      openModalFromChartContext('Drill to detail');

      cy.getBySel('filter-val').should('not.exist');

      // TODO: test clicking on a trendline
      // Cypress is refusing to rightclick on the dot
    });
  });
});
