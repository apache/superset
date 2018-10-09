import { selectResultsTab } from './sqllab.helper';

export default () => {
  describe('SqlLab datasource panel', () => {
    beforeEach(() => {
      cy.login();
      cy.server();
      cy.visit('/superset/sqllab');
    });

    it('creates a table schema and preview when a database, schema, and table are selected', () => {
      cy.route('/superset/table/**').as('tableMetadata');

      // it should have dropdowns to select database, schema, and table
      cy.get('.sql-toolbar .Select').should('have.length', 3);

      cy.get('.sql-toolbar .table-schema').should('not.exist');
      cy.get('.SouthPane .tab-content .filterable-table-container').should('not.exist');

      cy.get('.sql-toolbar .Select')
        .eq(0) // database select
        .within(() => {
          // note: we have to set force: true because the input is invisible / cypress throws
          cy.get('input').type('main{enter}', { force: true });
        });

      cy.get('.sql-toolbar .Select')
        .eq(1) // schema select
        .within(() => {
          cy.get('input').type('main{enter}', { force: true });
        });

      cy.get('.sql-toolbar .Select')
        .eq(2) // table select
        .within(() => {
          cy.get('input').type('birth_names{enter}', { force: true });
        });

      cy.wait('@tableMetadata');

      cy.get('.sql-toolbar .table-schema').should('have.length', 1);
      selectResultsTab().should('have.length', 1);

      // add another table and check for added schema + preview
      cy.get('.sql-toolbar .Select')
        .eq(2)
        .within(() => {
          cy.get('input').type('logs{enter}', { force: true });
        });

      cy.wait('@tableMetadata');

      cy.get('.sql-toolbar .table-schema').should('have.length', 2);
      selectResultsTab().should('have.length', 2);
    });
  });
};
