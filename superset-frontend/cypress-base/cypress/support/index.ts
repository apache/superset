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
import '@cypress/code-coverage/support';
import readResponseBlob from '../utils/readResponseBlob';

const BASE_EXPLORE_URL = '/superset/explore/?form_data=';

Cypress.Commands.add('login', () => {
  cy.request({
    method: 'POST',
    url: '/login/',
    body: { username: 'admin', password: 'general' },
  }).then(response => {
    expect(response.status).to.eq(200);
  });
});

Cypress.Commands.add('visitChartByName', name => {
  cy.request(`/chart/api/read?_flt_3_slice_name=${name}`).then(response => {
    cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${response.body.pks[0]}}`);
  });
});

Cypress.Commands.add('visitChartById', chartId => {
  return cy.visit(`${BASE_EXPLORE_URL}{"slice_id": ${chartId}}`);
});

Cypress.Commands.add('visitChartByParams', params => {
  const queryString =
    typeof params === 'string' ? params : JSON.stringify(params);
  return cy.visit(`${BASE_EXPLORE_URL}${queryString}`);
});

Cypress.Commands.add('verifyResponseCodes', (xhr: XMLHttpRequest, callback) => {
  // After a wait response check for valid response
  expect(xhr.status).to.eq(200);
  readResponseBlob(xhr.response.body).then(res => {
    expect(res).to.not.be.instanceOf(Error);
    if (callback) {
      callback(res);
    }
  });
  return cy;
});

Cypress.Commands.add('verifySliceContainer', chartSelector => {
  // After a wait response check for valid slice container
  cy.get('.slice_container').within(() => {
    if (chartSelector) {
      cy.get(chartSelector).then(chart => {
        expect(chart[0].clientWidth).greaterThan(0);
        expect(chart[0].clientHeight).greaterThan(0);
      });
    }
  });
  return cy;
});

Cypress.Commands.add(
  'verifySliceSuccess',
  ({
    waitAlias,
    querySubstring,
    chartSelector,
  }: {
    waitAlias: string;
    chartSelector: JQuery.Selector;
    querySubstring?: string | RegExp;
  }) => {
    cy.wait(waitAlias).then(xhr => {
      cy.verifySliceContainer(chartSelector);
      cy.verifyResponseCodes(xhr, responseBody => {
        if (querySubstring) {
          const query = responseBody
            ? (responseBody as { query: string }).query
            : '';
          if (querySubstring instanceof RegExp) {
            expect(query).to.match(querySubstring);
          } else {
            expect(query).to.contain(querySubstring);
          }
        }
      });
    });
    return cy;
  },
);
