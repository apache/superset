import shortid from 'shortid';
import { selectResultsTab } from '../../selectors';

// this function asserts that the result set for two SQL lab table results are equal
const assertSQLLabResultsAreEqual = (resultsA, resultsB) => {
  const [headerA, bodyWrapperA] = resultsA.childNodes;
  const bodyA = bodyWrapperA.childNodes[0];

  const [headerB, bodyWrapperB] = resultsB.childNodes;
  const bodyB = bodyWrapperB.childNodes[0];

  expect(headerA.childNodes.length).to.equal(headerB.childNodes.length);
  expect(bodyA.childNodes.length).to.equal(bodyB.childNodes.length);

  bodyA.childNodes.forEach((rowA, rowIndex) => {
    const rowB = bodyB.childNodes[rowIndex];

    rowA.childNodes.forEach((cellA, columnIndex) => {
      const cellB = rowB.childNodes[columnIndex];
      expect(cellA.innerText).to.equal(cellB.innerText);
    });
  });
};

describe('SqlLab query panel', () => {
  beforeEach(() => {
    cy.login();
    cy.server();
    cy.visit('/superset/sqllab');
  });

  // it('supports entering and running a query', () => {
  //   // note that the limit has to be < ~10 for us to be able to determine
  //   // how many rows are below (because React _Virtualized_ does not render all rows)
  //   const rowLimit = 3;
  //
  //   cy.get('#brace-editor textarea')
  //     .type(
  //       `{selectall}{backspace}SELECT ds, gender, name, num FROM main.birth_names LIMIT ${rowLimit}`,
  //       { force: true },
  //     )
  //     .then(() => {
  //       cy.get('#js-sql-toolbar button')
  //         .eq(0)
  //         .click()
  //         .then(() => {
  //           cy.get('.SouthPane .ReactVirtualized__Table')
  //             .eq(0) // ensures results tab in case preview tab exists
  //             .then((tableNodes) => {
  //               const [header, bodyWrapper] = tableNodes[0].childNodes;
  //               const body = bodyWrapper.childNodes[0];
  //               const expectedColCount = header.childNodes.length;
  //               const expectedRowCount = body.childNodes.length;
  //               expect(expectedColCount).to.equal(4);
  //               expect(expectedRowCount).to.equal(rowLimit);
  //             });
  //         });
  //     });
  // });

  it('successfully saves a query', () => {
    const query = 'SELECT ds, gender, name, num FROM main.birth_names ORDER BY name LIMIT 3';
    const savedQueryTitle = `CYPRESS TEST QUERY ${shortid.generate()}`;

    // we will assert that the results of the query we save, and the saved query are the same
    let initialResultsTable = null;
    let savedQueryResultsTable = null;

    cy.get('#brace-editor textarea')
      .type(`{selectall}{backspace}${query}`, { force: true })
      .focus() // focus => blur is required for updating the query that is to be saved
      .blur()
      .then(() => {
        // ctrl + r also runs query
        cy.get('#brace-editor textarea')
          .type('{ctrl}r', { force: true })
          .then(() => {
            selectResultsTab().then((resultsA) => {
              // Save results to check agains below
              initialResultsTable = resultsA[0];
              console.log('initialResultsTable', initialResultsTable);

              cy.get('#js-sql-toolbar button')
                .eq(1) // save query
                .click()
                .then(() => {
                  // Enter name + save into modal
                  cy.get('.modal-sm input')
                    .type(`{selectall}{backspace}${savedQueryTitle}`, {
                      force: true,
                    })
                    .then(() => {
                      cy.get('.modal-sm .modal-body button')
                        .eq(0)
                        .click()
                        .then(() => {
                          // visit saved queries
                          cy.visit('/sqllab/my_queries/').then(() => {
                            // first row contains most recent link
                            // visit saved query page
                            cy.get('table tr:first-child a[href*="savedQueryId"')
                              .click()
                              .then(() => {
                                cy.get('#js-sql-toolbar button')
                                  .eq(0) // Run query
                                  .click()
                                  .then(() => {
                                    selectResultsTab().then((resultsB) => {
                                      savedQueryResultsTable = resultsB[0];

                                      assertSQLLabResultsAreEqual(
                                        initialResultsTable,
                                        savedQueryResultsTable,
                                      );
                                    });
                                  });
                              });
                          });
                        });
                    });
                });
            });
          }); // run query
      });
  });
});
