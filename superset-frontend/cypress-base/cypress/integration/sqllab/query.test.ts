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
import * as shortid from 'shortid';
import { selectResultsTab } from './sqllab.helper';

describe('SqlLab query panel', () => {
  const mockTabId = '88889999';
  const mockQueryId = 'mock_qid_28dvde';

  beforeEach(() => {
    cy.intercept('/tableschemaview/', {
      id: 1,
    }).as('mockTableSchemaView');
    cy.intercept('/tabstate/', {
      id: 1,
    }).as('mockTabStateView');
    cy.intercept('GET', '/api/v1/database/?q=**', req => {
      req.continue(res => {
        res.send({ fixture: 'sqllab_databases.json' });
      });
    }).as('mockDatabaseList');
    cy.intercept('GET', '/api/v1/database/*/function_names/', {
      function_names: [],
    }).as('mockFunctionNameList');
    cy.intercept(
      {
        method: 'GET',
        url: '/api/v1/database/*/schemas/?q=*',
      },
      {
        result: ['mock'],
      },
    ).as('mockSchemaList');
    cy.intercept(
      {
        method: 'POST',
        url: '/superset/sql_json/',
      },
      req => {
        req.reply({
          delay: 800,
          fixture: 'sqllab_sql_json.json',
        });
      },
    ).as('mockSQLResponse');
    cy.intercept('GET', '/superset/tables/1/**', {
      fixture: 'sqllab_tables.json',
    }).as('mockTableList');
    cy.intercept('GET', '/api/v1/database/1/table/mock_table_1/*/', req => {
      req.reply({
        fixture: 'sqllab_table_1.json',
        delay: 500,
      });
    }).as('mockTable1Schema');
    cy.intercept('GET', '/api/v1/database/1/table_extra/mock_table_1/*/', {
      body: {},
    }).as('mockTable1SchemaExtra');
    cy.intercept('GET', '/superset/queries/*', {
      fixture: 'sqllab_queries_progress1.json',
    });
    cy.intercept('POST', 'tabstateview', {
      id: mockTabId,
    }).as('mockTabCreate');
    cy.intercept('PUT', `tabstateview/*`, req => {
      req.reply({
        id: req.url.match(/\d+$/)?.[0],
      });
    }).as('mockTabUpdate');
    cy.intercept('DELETE', `tabstateview/*`, req => {
      req.reply({
        id: req.url.match(/\d+$/)?.[0],
      });
    }).as('mockTabDelete');

    cy.stub(shortid, 'generate').returns(mockQueryId);

    cy.login();
    cy.visit('/superset/sqllab');
    cy.get(
      '#a11y-query-editor-tabs .ant-tabs-nav-list .ant-tabs-nav-add',
    ).click();
    // wait for 1000 milliseconds for rendering
    cy.wait(1000);
  });

  it('supports entering and running a query', () => {
    // multiple queries
    ['SELECT 1', 'SELECT * FROM MOCK_DATA_TABLE'].forEach(expectedQuery => {
      // multiple limit options
      [1, 3].forEach(limitSelectorIndex => {
        cy.get(
          '#js-sql-toolbar .leftItems a.ant-dropdown-trigger:last-child',
        ).click();
        cy.get(
          `.ant-dropdown:last-child .ant-dropdown-menu-item:nth-child(${limitSelectorIndex}) [role="button"]`,
        )
          .click()
          .then(el => {
            const limitSize = Number(el.text().replace(/ /g, ''));
            expect(limitSize).to.greaterThan(0);

            cy.wait('@mockTabUpdate')
              .its('request.body')
              .should(postForm => {
                expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
                  `"query_limit"${limitSize}`,
                );
              });

            cy.get('#ace-editor textarea.ace_text-input')
              .focus()
              .type(`{selectall}{backspace}${expectedQuery}`);

            cy.wait('@mockTabUpdate')
              .its('request.body')
              .should(postForm => {
                expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
                  `"sql""${expectedQuery}"`,
                );
              });
            cy.get('#js-sql-toolbar button:eq(0)').eq(0).click();

            cy.wait('@mockTabUpdate')
              .its('request.body')
              .should(postForm => {
                expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
                  '"latest_query_id',
                );
              });

            cy.wait('@mockSQLResponse')
              .its('request.body')
              .should(({ sql, sql_editor_id, queryLimit }) => {
                expect(sql).to.equal(expectedQuery);
                expect(sql_editor_id).to.equal(mockTabId);
                expect(queryLimit).to.equal(limitSize);
              });

            selectResultsTab().then(resultsB => {
              expect(
                (resultsB[0].childNodes[1].childNodes[0] as HTMLDivElement)
                  .innerText,
              ).to.equal('1\ndata row 1\n2\ndata row 2');
            });

            // wait for 1000 milliseconds for rendering
            cy.wait(1000);
          });
      });
    });
  });

  it('supports autocomplete', () => {
    cy.get('#ace-editor textarea.ace_text-input')
      .focus()
      .type(`{selectall}{backspace}mock_table`);

    // autocomplete for table names
    cy.get('.ace_autocomplete')
      .should('be.visible')
      .should(el => {
        expect(el.text()).to.include('mock_table_1');
        expect(el.text()).to.include('mock_table_2');
        expect(el.text()).to.include('mock_table_3');
      });

    // before a table schema loaded
    cy.get('#ace-editor textarea.ace_text-input')
      .focus()
      .type(`{selectall}{backspace}mock_tcolumn_nam`);

    cy.get('.ace_autocomplete').should('not.be.visible');

    cy.get('#ace-editor textarea.ace_text-input').blur();

    // select a table
    cy.get('.SqlEditorLeftBar .divider + .section [type=search]')
      .focus()
      .type('1')
      .type('{enter}')
      .blur();

    cy.wait('@mockTableSchemaView')
      .its('request.body')
      .should(postForm => {
        expect(postForm).to.include('"dbId":1');
        expect(postForm).to.include(`"queryEditorId":"${mockTabId}"`);
      });

    // inspect table record preview
    cy.wait('@mockSQLResponse')
      .its('request.body')
      .should(({ sql_editor_id, database_id }) => {
        expect(sql_editor_id).to.equal(null);
        expect(database_id).to.equal(1);
      });

    selectResultsTab().then(resultsB => {
      expect(
        (resultsB[0].childNodes[1].childNodes[0] as HTMLDivElement).innerText,
      ).to.equal('1\ndata row 1\n2\ndata row 2');
    });

    cy.get('#ace-editor textarea.ace_text-input')
      .focus()
      .clear()
      .type(`{selectall}{backspace}mock_tcolumn_nam`);

    // autocomplete for table schema
    cy.get('.ace_autocomplete')
      .should('be.visible')
      .should(el => {
        expect(el.text()).to.include('mock_tcolumn_name');
      });

    cy.get('#ace-editor textarea.ace_text-input').blur();

    // turn off autocomplete
    cy.get(
      '#js-sql-toolbar .rightItems .ant-dropdown-trigger:last-child',
    ).click();
    cy.get('.ant-dropdown button[name="autocomplete-switch"]').click();

    cy.get('#ace-editor textarea.ace_text-input')
      .focus()
      .clear()
      .type(`{selectall}{backspace}mock_table`);

    // autocomplete should be skipped
    cy.get('.ace_autocomplete').should('not.be.visible');
    cy.get('#ace-editor textarea.ace_text-input').blur();

    cy.get('#ace-editor textarea.ace_text-input')
      .focus()
      .clear()
      .type(`{selectall}{backspace}mock_tcolumn_nam`);

    cy.get('.ace_autocomplete').should('not.be.visible');

    cy.get('#ace-editor textarea.ace_text-input').blur();
  });

  it('successfully saves a query', () => {
    const query =
      'SELECT ds, gender, name, num FROM main.birth_names ORDER BY name LIMIT 3';
    const savedQueryTitle = `CYPRESS TEST QUERY ${shortid.generate()}`;
    const savedQueryDescription = 'CYPRESS TEST DESCRIPTION';

    const mockResponse = {
      item: {
        db_id: 1,
        description: savedQueryDescription,
        extra_json: '{}',
        id: 7766,
        label: savedQueryTitle,
        schema: 'main',
        sql: query,
      },
      message: 'Added Row',
      severity: 'success',
    };
    cy.intercept('POST', '/savedqueryviewapi/api/create', mockResponse).as(
      'mockSaveQuery',
    );
    cy.intercept(
      'PUT',
      `/savedqueryviewapi/api/update/${mockResponse.item.id}`,
      mockResponse,
    ).as('mockUpdateQuery');

    cy.get('#ace-editor textarea.ace_text-input')
      .focus()
      .clear()
      .type(`{selectall}{backspace}${query}`, { delay: 0 });

    cy.get('.SaveQuery [type=button]').click();

    cy.get('.save-query-modal [type=text]')
      .focus()
      .type(`{selectall}{backspace}${savedQueryTitle}`);
    cy.get('.save-query-modal textarea')
      .focus()
      .type(`{selectall}{backspace}${savedQueryDescription}`);

    cy.get('.save-query-modal .cta:last-child').click();

    // save original query data
    cy.wait('@mockSaveQuery')
      .its('request.body')
      .should(postForm => {
        expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
          `name="label"${savedQueryTitle}`,
        );
        expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
          `name="sql"${query}`,
        );
        expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
          `name="description"${savedQueryDescription}`,
        );
      });

    // update limit size
    cy.get(
      '#js-sql-toolbar .leftItems .ant-dropdown-trigger:last-child',
    ).click();
    cy.get(
      `.ant-dropdown:last-child .ant-dropdown-menu-item:nth-child(2) [role="button"]`,
    )
      .click()
      .then(el => {
        const limitSize = Number(el.text().replace(/ /g, ''));

        cy.get('.SaveQuery [type=button]').click();

        // change title and description
        cy.get('.save-query-modal [type=text]')
          .focus()
          .clear()
          .type(`{selectall}{backspace}${savedQueryTitle}1`);
        cy.get('.save-query-modal textarea')
          .focus()
          .clear()
          .type(`{selectall}{backspace}${savedQueryDescription}1`);

        cy.get('.save-query-modal .cta:last-child').click();

        // update existing query data
        cy.wait('@mockUpdateQuery')
          .its('request.body')
          .should(postForm => {
            expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
              `name="label"${savedQueryTitle}1`,
            );
            expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
              `name="sql"${query}`,
            );
            expect(postForm.replace(/(?:\r\n|\r|\n)/g, '')).to.include(
              `name="queryLimit"${limitSize}`,
            );
          });
      });
  });
});
