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

import { Page, Locator, Response } from '@playwright/test';
import { URL } from '../utils/urls';
import { Modal } from '../components/core';

/**
 * Page Object for the Database List / Add Database modal.
 * Encapsulates interactions required by the migrated Cypress tests.
 *
 * Assertions remain in test files; this class only exposes actions & queries.
 */
export class DatabaseListPage {
    private readonly page: Page;

    private static readonly SELECTORS = {
        CREATE_BUTTON: '[data-test="btn-create-database"]',
        DATABASE_MODAL: '[data-test="database-modal"]',
        CLOSE_MODAL_BUTTON: '[aria-label="Close"]',
        PREFERRED_FIRST_ENGINE: '.preferred > :nth-child(1)',
        SQLA_CONNECT_BUTTON: '[data-test="sqla-connect-btn"]',
        SUBMIT_CONNECTION_BUTTON: '[data-test="btn-submit-connection"]',
        INPUT_HOST: 'input[name="host"]',
        INPUT_PORT: 'input[name="port"]',
        INPUT_DB: 'input[name="database"]',
        INPUT_USERNAME: 'input[name="username"]',
        INPUT_PASSWORD: 'input[name="password"]',
        INPUT_DB_NAME: 'input[name="database_name"]',
        DATABASE_NAME_INPUT: '[data-test="database-name-input"]',
        SQLALCHEMY_URI_INPUT: '[data-test="sqlalchemy-uri-input"]',
        ERROR_ITEM: '.ant-form-item-explain-error',
    } as const;

    constructor(page: Page) {
        this.page = page;
    }

    /** Navigate to the database list view */
    async goto(): Promise<void> {
        await this.page.goto(URL.DATABASE_LIST);
    }

    /** Open the create database modal */
    async openCreateDatabaseModal(): Promise<void> {
        await this.page.locator(DatabaseListPage.SELECTORS.CREATE_BUTTON).click();
        await this.getDatabaseModal().waitFor({ state: 'visible' });
    }

    /** Returns locator for the database modal */
    getDatabaseModal(): Locator {
        return this.page.locator(DatabaseListPage.SELECTORS.DATABASE_MODAL);
    }

    /** Close modal if currently open (idempotent) */
    async closeModalIfOpen(): Promise<void> {
        const modal = this.getDatabaseModal();
        if (await modal.isVisible()) {
            const closeButtons = this.page.locator(
                DatabaseListPage.SELECTORS.CLOSE_MODAL_BUTTON,
            );
            const count = await closeButtons.count();
            // Cypress used eq(1); keep same semantics if present
            if (count > 1) {
                await closeButtons.nth(1).click();
            } else if (count === 1) {
                await closeButtons.first().click();
            }
            await modal.waitFor({ state: 'hidden' });
        }
    }

    /** Select first preferred engine card (dynamic form) */
    async selectFirstPreferredEngine(): Promise<void> {
        await this.page
            .locator(DatabaseListPage.SELECTORS.PREFERRED_FIRST_ENGINE)
            .click();
    }

    /** Click SQLAlchemy connect button to switch form */
    async clickSqlAlchemyConnect(): Promise<void> {
        await this.page
            .locator(DatabaseListPage.SELECTORS.SQLA_CONNECT_BUTTON)
            .click();
    }

    /** Get dynamic form input by semantic name */
    getDynamicInput(name: 'host' | 'port' | 'database' | 'username' | 'password' | 'database_name'): Locator {
        switch (name) {
            case 'host':
                return this.page.locator(DatabaseListPage.SELECTORS.INPUT_HOST);
            case 'port':
                return this.page.locator(DatabaseListPage.SELECTORS.INPUT_PORT);
            case 'database':
                return this.page.locator(DatabaseListPage.SELECTORS.INPUT_DB);
            case 'username':
                return this.page.locator(DatabaseListPage.SELECTORS.INPUT_USERNAME);
            case 'password':
                return this.page.locator(DatabaseListPage.SELECTORS.INPUT_PASSWORD);
            case 'database_name':
                return this.page.locator(DatabaseListPage.SELECTORS.INPUT_DB_NAME);
        }
    }

    /** Fill dynamic form inputs (only provided fields) */
    async fillDynamicForm(values: Partial<{
        host: string;
        port: string;
        database: string;
        username: string;
        password: string;
        database_name: string;
    }>): Promise<void> {
        for (const [key, value] of Object.entries(values)) {
            if (value) {
                const locator = this.getDynamicInput(key as any);
                await locator.fill(value);
            }
        }
        // Blur by clicking body to trigger validation
        await this.page.locator('body').click({ position: { x: 0, y: 0 } });
    }

    /** Locator for submit connection button */
    getSubmitConnectionButton(): Locator {
        return this.page.locator(
            DatabaseListPage.SELECTORS.SUBMIT_CONNECTION_BUTTON,
        );
    }

    /** Submit connection (waits for validate + create requests) */
    async submitConnectionAndWait(): Promise<Response> {
        // Wait for validate request triggered by click
        const validatePromise = this.waitForValidateParams();
        await this.getSubmitConnectionButton().click();
        await validatePromise;
        // After validation, creation request fires
        const createPromise = this.waitForCreateDb();
        // Some flows click again; emulate defensive double submit if still enabled
        if (await this.getSubmitConnectionButton().isEnabled()) {
            // No need to await here; ensure idempotency
            await this.getSubmitConnectionButton().click();
        }
        const createResponse = await createPromise;
        return createResponse;
    }

    /** Wait for validate parameters POST response */
    async waitForValidateParams(): Promise<Response> {
        return this.page.waitForResponse(
            r =>
                r.request().method() === 'POST' &&
                r.url().includes('/api/v1/database/validate_parameters/'),
        );
    }

    /** Wait for create database POST response */
    async waitForCreateDb(): Promise<Response> {
        return this.page.waitForResponse(
            r => r.request().method() === 'POST' && r.url().includes('/api/v1/database/'),
        );
    }

    /** Locator for SQLAlchemy form inputs */
    getSqlAlchemyFormLocators(): { nameInput: Locator; uriInput: Locator } {
        return {
            nameInput: this.page.locator(DatabaseListPage.SELECTORS.DATABASE_NAME_INPUT),
            uriInput: this.page.locator(DatabaseListPage.SELECTORS.SQLALCHEMY_URI_INPUT),
        };
    }

    /** Error message locator */
    getErrorMessages(): Locator {
        return this.page.locator(DatabaseListPage.SELECTORS.ERROR_ITEM);
    }
}
