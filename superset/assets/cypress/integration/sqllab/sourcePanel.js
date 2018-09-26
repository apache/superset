import { selectResultsTab } from '../../selectors';

describe('SqlLab datasource panel', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit('/superset/sqllab');
  });

  it('renders dropdowns to select database, schema, and table', () => {
    cy.get('.sql-toolbar .Select').then((nodes) => {
      expect(nodes).to.have.length(3);
    });
  });

  it('creates a table schema and preview when a database, schema, and table are selected', () => {
    cy.get('.sql-toolbar .table-schema').should('not.exist');
    cy.get('.SouthPane .tab-content .filterable-table-container').should('not.exist');

    cy.get('.sql-toolbar .Select')
      .eq(0)
      .within(() => {
        // note: we have to set force: true because the input is invisible / cypress throws
        cy.get('input').type('main{enter}', { force: true });
      })
      .then(() => {
        cy.get('.sql-toolbar .Select')
          .eq(1)
          .within(() => {
            cy.get('input').type('main{enter}', { force: true });
          });
      })
      .then(() => {
        cy.get('.sql-toolbar .Select')
          .eq(2)
          .within(() => {
            cy.get('input').type('birth_names{enter}', { force: true });
          });
      })
      .then(() => {
        cy.get('.sql-toolbar .table-schema').should('have.length', 1);
        selectResultsTab().should('have.length', 1);
      })
      .then(() => {
        cy.get('.sql-toolbar .Select')
          .eq(2)
          .within(() => {
            cy.get('input').type('logs{enter}', { force: true });
          });
      })
      .then(() => {
        cy.get('.sql-toolbar .table-schema').should('have.length', 2);
        selectResultsTab().should('have.length', 2);
      });
  });
});
