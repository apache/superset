// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

import './commands';

// The following is a workaround for Cypress not supporting fetch.
// By setting window.fetch = null, we force the fetch polyfill to fall back
// to xhr as described here https://github.com/cypress-io/cypress/issues/95
Cypress.on('window:before:load', (win) => {
  win.fetch = null; // eslint-disable-line no-param-reassign
});
