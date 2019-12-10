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

export default () => {
  describe('CSV importer for a new database', () => {

    const sqliteDatabaseName = 'new_sqlite_database';
    const postgresqlDatabaseName = 'new_postgresql_database';

    beforeEach(() => {
      cy.login();
      cy.server();
      cy.visit('/csvimporter/csvtodatabase');

      cy.route('/tablemodelview/list').as('finish_import');

      cy.exec('python cypress/integration/csvimport/scripts/remove_db_file.py ' + sqliteDatabaseName, { timeout: 30000 });
      cy.exec('python cypress/integration/csvimport/scripts/remove_db_file.py ' + postgresqlDatabaseName, { timeout: 30000 });
    });

    afterEach(() => {
      cy.exec('python cypress/integration/csvimport/scripts/remove_db_file.py ' + sqliteDatabaseName, { timeout: 30000 });
      cy.exec('python cypress/integration/csvimport/scripts/remove_db_file.py ' + postgresqlDatabaseName, { timeout: 30000 });
    });

    it('test import in new SQLite database', () => {

      cy.get('#tableName')
        .clear({ force: true })
        .type(
        'MyCsvTableForNewSQlite',
        { force: true },
      );

      cy.upload_file('myCsv.csv', 'text/csv', 'aaa;bbb;ccc;\nddd;eee;fff;', '#file');

      cy.get('#database').then((elem) => {
        elem.val('-1');
      });

      cy.get('#databaseName')
        .clear({ force: true })
        .type(
        sqliteDatabaseName,
        { force: true },
      );

      cy.get('#databaseFlavor').then((elem) => {
        elem.val('sqlite');
      });

      cy.get('#delimiter')
        .clear({ force: true })
        .type(
        ';',
        { force: true },
      );

      cy.get('button').contains('Save').click();
      cy.url({ timeout: 30000 }).should('include', '/tablemodelview/list');
    });

    it('test import in new PostgreSQL database', () => {

      cy.get('#tableName')
        .clear({ force: true })
        .type(
        'MyCsvTableForNewPG',
        { force: true },
      );

      cy.upload_file('myCsv.csv', 'text/csv', 'aaa,bbb,ccc,\nddd,eee,fff,', '#file');

      cy.get('#database').then((elem) => {
        elem.val('-1');
      });

      cy.get('#databaseName')
        .clear({ force: true })
        .type(
        postgresqlDatabaseName,
        { force: true },
      );

      cy.get('#databaseFlavor').then((elem) => {
        elem.val('postgresql');
      });

      cy.get('#delimiter')
        .clear({ force: true })
        .type(
        ',',
        { force: true },
      );

      cy.get('button').contains('Save').click();
      cy.url({ timeout: 30000 }).should('include', '/tablemodelview/list');
    });

  });
};
