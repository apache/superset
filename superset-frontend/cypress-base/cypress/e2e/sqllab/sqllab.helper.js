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
