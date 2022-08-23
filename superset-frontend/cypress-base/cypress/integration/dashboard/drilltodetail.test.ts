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
  waitForChartLoad,
  ECHARTS_CHARTS,
  ECHARTS_DASHBOARD,
} from './dashboard.helper';

function interceptSamples() {
  cy.intercept(`/datasource/samples*`).as('samples');
}

describe('Drill to detail modal', () => {
  beforeEach(() => {
    cy.login();
    cy.visit(ECHARTS_DASHBOARD);
    ECHARTS_CHARTS.forEach(waitForChartLoad);
  });

  describe('Box plot', () => {
    it('opens the modal with the correct data', () => {
      interceptSamples();

      // opens the modal from context menu
      cy.get(
        "[data-test-viz-type='box_plot'] [aria-label='More Options']",
      ).click();
      cy.get('.ant-dropdown')
        .not('.ant-dropdown-hidden')
        .find("[role='menu'] [role='menuitem']")
        .eq(5)
        .should('contain', 'Drill to detail').click();
      cy.get("[role='dialog'] .draggable-trigger").should(
        'contain',
        'Drill to detail: Box plot',
      );
      cy.get("[aria-label='Close']").eq(1).click();

      // opens the modal by clicking on the chart
      cy.get("[data-test-viz-type='box_plot'] canvas").then($canvas => {
        const canvasWidth = $canvas.width() || 0;
        const canvasHeight = $canvas.height() || 0;
        const canvasCenterX = canvasWidth / 6;
        const canvasCenterY = canvasHeight / 6;

        cy.wrap($canvas)
          .scrollIntoView()
          .rightclick(canvasCenterX, canvasCenterY, { force: true });
        cy.get('.ant-dropdown')
          .not('.ant-dropdown-hidden')
          .find("[role='menu'] [role='menuitem']")
          .should('contain', 'Drill to detail by East Asia & Pacific')
          .click();
        cy.wait('@samples');

        // checking the filtered data
        cy.get("[data-test='filter-val']").should('contain', 'East Asia & Pacific');
        cy.get("[data-test='row-count-label']").should('contain', '1.98k rows');
        cy.get("[role='rowgroup'] [role='row']")
          .should('have.length', 50)
          .then($rows => {
            expect($rows).to.contain('American Samoa');
          });
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .should('have.length', 9)
          .then($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('40');
          });

          // clear the filter and test data was reloaded
          // @TODO
      });
    });
  });

  describe('Big number total', () => {
    it('opens the modal with the correct data', () => {
      interceptSamples();

      // opens the modal from context menu
      cy.get(
        "[data-test-viz-type='big_number_total'] [aria-label='More Options']",
      ).click();
      cy.get('.ant-dropdown')
        .not('.ant-dropdown-hidden')
        .find("[role='menu'] [role='menuitem']")
        .eq(5)
        .should('contain', 'Drill to detail').click();
      cy.get("[role='dialog'] .draggable-trigger").should(
        'contain',
        'Drill to detail: Number of Girls',
      );
      cy.get("[aria-label='Close']").eq(1).click();

      // opens the modal by clicking on the number
      cy.get(
        "[data-test-viz-type='big_number_total'] .header-line",
      ).rightclick();
      cy.get('.ant-dropdown')
        .not('.ant-dropdown-hidden')
        .find("[role='menu'] [role='menuitem']")
        .should('contain', 'Drill to detail')
        .click();
      cy.wait('@samples');

      // checking the data
      cy.get("[data-test='row-count-label']").should('contain', '36.4k rows');
      cy.get("[role='table']")
        .find("[role='columnheader']")
        .should('have.length', 8)
        .then($columnheaders => {
          expect($columnheaders).to.contain('ds');
          expect($columnheaders).to.contain('gender');
          expect($columnheaders).to.contain('name');
          expect($columnheaders).to.contain('state');
          expect($columnheaders).to.contain('num_boys');
          expect($columnheaders).to.contain('num_girls');
          expect($columnheaders).to.contain('num_california');
        });
      cy.get("[role='rowgroup'] [role='row']")
        .should('have.length', 50)
        .then($rows => {
          expect($rows).to.contain('Amy');
        });

      // checking paginated data
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

      // checking refreshed data
      cy.get("[aria-label='reload']").click();
      cy.wait('@samples');
      cy.get(".pagination-container [role='navigation'] li.active").should(
        'contain',
        '1',
      );
      cy.get("[role='rowgroup'] [role='row']")
        .should('have.length', 50)
        .then($rows => {
          expect($rows).to.contain('Amy');
        });
    });
  });

  describe('Big number with trendline', () => {
    it('opens the modal with the correct data', () => {
      interceptSamples();

      // opens the modal from context menu
      cy.get(
        "[data-test-viz-type='big_number'] [aria-label='More Options']",
      ).click();
      cy.get('.ant-dropdown')
        .not('.ant-dropdown-hidden')
        .find("[role='menu'] [role='menuitem']")
        .eq(5)
        .should('contain', 'Drill to detail').click();
      cy.get("[role='dialog'] .draggable-trigger").should(
        'contain',
        'Drill to detail: Participants',
      );
      cy.get("[aria-label='Close']").eq(1).click();

      // opens the modal by clicking on the number
      cy.get("[data-test-viz-type='big_number'] .header-line").rightclick();
      cy.get('.ant-dropdown')
        .not('.ant-dropdown-hidden')
        .find("[role='menu'] [role='menuitem']")
        .should('contain', 'Drill to detail')
        .click();
      cy.wait('@samples');

      // checking the data
      cy.get('.ant-tag').should('contain', '75.7k rows');
      cy.get("[role='table']")
        .find("[role='columnheader']")
        .should('have.length', 8)
        .then($columnheaders => {
          expect($columnheaders).to.contain('ds');
          expect($columnheaders).to.contain('gender');
          expect($columnheaders).to.contain('name');
          expect($columnheaders).to.contain('state');
          expect($columnheaders).to.contain('num_boys');
          expect($columnheaders).to.contain('num_girls');
          expect($columnheaders).to.contain('num_california');
        });
      cy.get("[role='rowgroup'] [role='row']")
        .should('have.length', 50)
        .then($rows => {
          expect($rows).to.contain('Aaron');
        });

      // checking paginated data
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
        .should('have.length', 41)
        .then($rows => {
          expect($rows).to.contain('Zachary');
        });

      // checking refreshed data
      cy.get("[aria-label='reload']").click();
      cy.wait('@samples');
      cy.get(".pagination-container [role='navigation'] li.active").should(
        'contain',
        '1',
      );
      cy.get("[role='rowgroup'] [role='row']")
        .should('have.length', 50)
        .then($rows => {
          expect($rows).to.contain('Aaron');
        });
      cy.get("[aria-label='Close']").eq(1).click();

      // opens the modal by clicking on the trendline
      cy.get("[data-test-viz-type='big_number'] canvas").then($canvas => {
        const canvasWidth = $canvas.width() || 0;
        const canvasHeight = $canvas.height() || 0;
        const canvasCenterX = canvasWidth / 2;
        // @TODO
        cy.wrap($canvas).scrollIntoView().rightclick(canvasCenterX, 1);
        cy.get('.ant-dropdown')
          .not('.ant-dropdown-hidden')
          .find("[role='menu'] [role='menuitem']")
          .should('contain', 'Drill to detail by 1987-01-01')
          .click();
        cy.wait('@samples');

        // checking the filtered data
        cy.get("[data-test='filter-val']").should('contain', '1987-01-01');
        cy.get("[data-test='row-count-label']").should('contain', '1.85k rows');
        cy.get("[role='rowgroup'] [role='row']")
          .should('have.length', 50)
          .then($rows => {
            expect($rows).to.contain('Aaron');
          });
        cy.get(".pagination-container [role='navigation'] [role='button']")
          .should('have.length', 9)
          .then($pages => {
            expect($pages).to.contain('1');
            expect($pages).to.contain('37');
          });

          // clear and check the filtered data
          // @TODO
      });
    });
  });
});
