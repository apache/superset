// ***********************************************
// This example commands.js shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add("login", (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add("drag", { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add("dismiss", { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This is will overwrite an existing command --
// Cypress.Commands.overwrite("visit", (originalFn, url, options) => { ... })

import readResponseBlob from '../utils/readResponseBlob';

const BASE_EXPLORE_URL = '/superset/explore/?form_data=';

Cypress.Commands.add('login', () => {
  cy.request({
    method: 'POST',
    url: '/login/',
    body: { username: 'admin', password: 'general' },
  }).then((response) => {
    expect(response.status).to.eq(200);
  });
});

Cypress.Commands.add('visitChartByName', (name) => {
  cy.request(`/chart/api/read?_flt_3_slice_name=${name}`).then((response) => {
    cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${response.body.pks[0]}}`);
  });
});

Cypress.Commands.add('visitChartById', (chartId) => {
  cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${chartId}}`);
});

Cypress.Commands.add('visitChartByParams', (params) => {
  cy.visit(`${BASE_EXPLORE_URL}${params}`);
});

Cypress.Commands.add('verifyResponseCodes', async (xhr) => {
  // After a wait response check for valid response
  expect(xhr.status).to.eq(200);

  const responseBody = await readResponseBlob(xhr.response.body);

  if (responseBody.error) {
    expect(responseBody.error).to.eq(null);
  }
});

Cypress.Commands.add('verifySliceContainer', (chartSelector) => {
  // After a wait response check for valid slice container
  cy.get('.slice_container').within(() => {
    if (chartSelector) {
      cy.get(chartSelector).then((charts) => {
        const firstChart = charts[0];
        expect(firstChart.clientWidth).greaterThan(0);
        expect(firstChart.clientHeight).greaterThan(0);
      });
    }
  });
});

Cypress.Commands.add('verifySliceSuccess', ({ waitAlias, querySubstring, chartSelector }) => {
  cy.wait(waitAlias).then(async (xhr) => {
    cy.verifyResponseCodes(xhr);

    const responseBody = await readResponseBlob(xhr.response.body);
    if (querySubstring) {
      expect(responseBody.query).contains(querySubstring);
    }

    cy.verifySliceContainer(chartSelector);
  });
});
