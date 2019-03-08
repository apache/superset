import shortid from 'shortid';
import { selectResultsTab, assertSQLLabResultsAreEqual } from './sqllab.helper';

export default () => {
  describe('SqlLab query panel', () => {
    beforeEach(() => {
      cy.login();
      cy.server();
      cy.visit('/superset/sqllab');

      cy.route('POST', '/superset/sql_json/**').as('sqlLabQuery');
    });

    it('supports entering and running a query', () => {
      // row limit has to be < ~10 for us to be able to determine how many rows
      // are fetched below (because React _Virtualized_ does not render all rows)
      const rowLimit = 3;

      cy.get('#brace-editor textarea').type(
        `{selectall}{backspace}SELECT ds, gender, name, num FROM main.birth_names LIMIT ${rowLimit}`,
        { force: true },
      );
      cy.get('#js-sql-toolbar button')
        .eq(0)
        .click();

      cy.wait('@sqlLabQuery');

      selectResultsTab()
        .eq(0) // ensures results tab in case preview tab exists
        .then((tableNodes) => {
          const [header, bodyWrapper] = tableNodes[0].childNodes;
          const body = bodyWrapper.childNodes[0];
          const expectedColCount = header.childNodes.length;
          const expectedRowCount = body.childNodes.length;
          expect(expectedColCount).to.equal(4);
          expect(expectedRowCount).to.equal(rowLimit);
        });
    });

    it('successfully saves a query', () => {
      cy.route('savedqueryviewapi/**').as('getSavedQuery');
      cy.route('superset/tables/**').as('getTables');

      const query = 'SELECT ds, gender, name, num FROM main.birth_names ORDER BY name LIMIT 3';
      const savedQueryTitle = `CYPRESS TEST QUERY ${shortid.generate()}`;

      // we will assert that the results of the query we save, and the saved query are the same
      let initialResultsTable = null;
      let savedQueryResultsTable = null;

      cy.get('#brace-editor textarea')
        .type(`{selectall}{backspace}${query}`, { force: true })
        .focus() // focus => blur is required for updating the query that is to be saved
        .blur();

      // ctrl + r also runs query
      cy.get('#brace-editor textarea').type('{ctrl}r', { force: true });

      cy.wait('@sqlLabQuery');

      // Save results to check agains below
      selectResultsTab().then((resultsA) => {
        initialResultsTable = resultsA[0];
      });

      cy.get('#js-sql-toolbar button')
        .eq(1) // save query
        .click();

      // Enter name + save into modal
      cy.get('.modal-sm input').type(`{selectall}{backspace}${savedQueryTitle}`, {
        force: true,
      });

      cy.get('.modal-sm .modal-body button')
        .eq(0) // save
        .click();

      // visit saved queries
      cy.visit('/sqllab/my_queries/');

      // first row contains most recent link, follow back to SqlLab
      cy.get('table tr:first-child a[href*="savedQueryId"').click();

      // will timeout without explicitly waiting here
      cy.wait(['@getSavedQuery', '@getTables']);

      // run the saved query
      cy.get('#js-sql-toolbar button')
        .eq(0) // run query
        .click();

      cy.wait('@sqlLabQuery');

      // assert the results of the saved query match the initial results
      selectResultsTab().then((resultsB) => {
        savedQueryResultsTable = resultsB[0];

        assertSQLLabResultsAreEqual(initialResultsTable, savedQueryResultsTable);
      });
    });
  });
};
