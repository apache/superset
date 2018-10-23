export const selectResultsTab = () =>
  cy.get('.SouthPane .ReactVirtualized__Table', { timeout: 10000 });

// this function asserts that the result set for two SQL lab table results are equal
export const assertSQLLabResultsAreEqual = (resultsA, resultsB) => {
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
