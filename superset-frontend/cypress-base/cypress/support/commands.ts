/// <reference types="cypress" />

declare namespace Cypress {
  interface Chainable {
    retryAssertion(
      assertionFn: () => void,
      options?: Partial<Cypress.WaitUntilOptions>,
    ): Chainable<any>;
  }
}

Cypress.Commands.add('retryAssertion', (assertionFn, options = {}) => {
  const defaultOptions: Cypress.WaitUntilOptions = {
    timeout: 10000,
    interval: 1000,
  };
  const opts = { ...defaultOptions, ...options };

  return cy.waitUntil(assertionFn, opts);
});
