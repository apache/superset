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
import { test, expect } from '@playwright/test';
import { DatabaseListPage } from '../../pages/DatabaseListPage';

/**
 * Migration notes from Cypress (modal.test.ts):
 * - cy.visit -> page.goto via page object (goto)
 * - cy.getBySel / cy.get -> page.locator & page object helpers
 * - cy.intercept + cy.wait -> waitForResponse inside page object
 * - Cypress command queue removed; explicit async/await sequence
 * - closeModal helper replaced with idempotent closeModalIfOpen()
 * - Assertions remain in test; page object only provides actions & queries
 */

test.describe('Add database modal', () => {
    let dbPage: DatabaseListPage;

    test.beforeEach(async ({ page }) => {
        dbPage = new DatabaseListPage(page);
        await dbPage.goto();
        await dbPage.closeModalIfOpen();
        await dbPage.openCreateDatabaseModal();
    });

    test('should open dynamic form', async () => {
        await dbPage.selectFirstPreferredEngine();

        // Assert empty initial values
        await expect(dbPage.getDynamicInput('host')).toHaveValue('');
        await expect(dbPage.getDynamicInput('port')).toHaveValue('');
        await expect(dbPage.getDynamicInput('database')).toHaveValue('');
        await expect(dbPage.getDynamicInput('username')).toHaveValue('');
        await expect(dbPage.getDynamicInput('password')).toHaveValue('');
        await expect(dbPage.getDynamicInput('database_name')).not.toHaveValue('');
    });

    test('should open sqlalchemy form', async () => {
        await dbPage.selectFirstPreferredEngine();
        await dbPage.clickSqlAlchemyConnect();
        const { nameInput, uriInput } = dbPage.getSqlAlchemyFormLocators();
        await expect(nameInput).toBeVisible();
        await expect(uriInput).toBeVisible();
    });

    test('show error alerts on dynamic form for bad host', async () => {
        await dbPage.selectFirstPreferredEngine();

        await dbPage.fillDynamicForm({
            host: 'badhost',
            port: '5432',
            username: 'testusername',
            database: 'testdb',
            password: 'testpass',
        });

        // Wait for validation (host resolution failure expected)
        await dbPage.waitForValidateParams();

        await expect(dbPage.getSubmitConnectionButton()).toBeEnabled();

        // Submit connection & await creation attempt
        await dbPage.submitConnectionAndWait();

        // Expect error message about hostname
        await expect(dbPage.getErrorMessages().first()).toContainText(
            "The hostname provided can't be resolved",
        );
    });

    test('show error alerts on dynamic form for bad port', async () => {
        await dbPage.selectFirstPreferredEngine();

        // Host first (valid), triggers validation
        await dbPage.fillDynamicForm({ host: 'localhost' });
        await dbPage.waitForValidateParams();

        // Port & other fields
        await dbPage.fillDynamicForm({
            port: '5430',
            database: 'testdb',
            username: 'testusername',
        });
        await dbPage.waitForValidateParams();

        await dbPage.fillDynamicForm({ password: 'testpass' });
        await dbPage.waitForValidateParams();

        // Ensure button enabled
        await expect(dbPage.getSubmitConnectionButton()).toBeEnabled();

        // Submit & wait for creation
        await dbPage.submitConnectionAndWait();

        await expect(dbPage.getErrorMessages().first()).toContainText(
            'The port is closed',
        );
    });
});