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

const BASE_URL = '/superset/explore/?form_data=';

Cypress.Commands.add('login', () => {
  cy.request({
    method: 'POST',
    url: 'http://localhost:8081/login/',
    body: { username: 'admin', password: 'general' },
  }).then((response) => {
    expect(response.status).to.eq(200);
  });
});

Cypress.Commands.add('visitChart', ({ name, sliceId, formData }) => {

  if (name) {
    cy.request(`http://localhost:8081/chart/api/read?_flt_3_slice_name=${name}`).then((response) => {
      cy.visit(`${BASE_URL}{"slice_id": ${response.body.pks[0]}}`);
    });
  } else if (formData) {
    cy.visit(`${BASE_URL}${formData}`);
  } else {
    cy.visit(`${BASE_URL}{"slice_id": ${sliceId}}`);
  }
});

Cypress.Commands.add('verifySliceSuccess', (waitAlias) => {
  cy.wait([waitAlias]).then((data) => {
    expect(data.status).to.eq(200);
    expect(data.response.body).to.have.property('error', null);
    cy.get('.slice_container');
  });
});
