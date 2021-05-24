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
import React from 'react';
import fetchMock from 'fetch-mock';
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import DatabaseModal from './index';

const dbProps = {
  show: true,
  databaseId: 10,
  database_name: 'my database',
  sqlalchemy_uri: 'postgres://superset:superset@something:1234/superset',
};

const DATABASE_FETCH_ENDPOINT = 'glob:*/api/v1/database/10';
const DATABASE_POST_ENDPOINT = 'glob:*/api/v1/database/';
const AVAILABLE_DB_ENDPOINT = 'glob:*/api/v1/database/available*';
fetchMock.config.overwriteRoutes = true;
fetchMock.get(DATABASE_FETCH_ENDPOINT, {
  result: {
    id: 10,
    database_name: 'my database',
    expose_in_sqllab: false,
    allow_ctas: false,
    allow_cvas: false,
    configuration_method: 'sqlalchemy_form',
  },
});
fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
  databases: [
    {
      engine: 'mysql',
      name: 'MySQL',
      preferred: false,
    },
  ],
});

describe('DatabaseModal', () => {
  afterEach(fetchMock.restore);
  describe('initial load', () => {
    it('hides the forms from the db when not selected', () => {
      render(<DatabaseModal show databaseId={1} />, { useRedux: true });
      // Select Advanced tab
      const advancedTab = screen.getByRole('tab', {
        name: /advanced/i,
      });
      userEvent.click(advancedTab);
      // Select SQL Lab tab
      const sqlLabSettingsTab = screen.getByRole('tab', {
        name: /sql lab/i,
      });
      userEvent.click(sqlLabSettingsTab);

      const exposeInSqlLab = screen.getByText('Expose in SQL Lab');
      const exposeChoicesForm = exposeInSqlLab.parentElement.nextSibling;
      const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;
      expect(exposeChoicesForm).not.toHaveClass('open');
      expect(schemaField).not.toHaveClass('open');
    });
  });
  it('renders all settings when "Expose in SQL Lab" is checked', () => {
    render(<DatabaseModal {...dbProps} />, { useRedux: true });

    // Select Advanced tab
    const advancedTab = screen.getByRole('tab', {
      name: /advanced/i,
    });
    userEvent.click(advancedTab);

    // Select SQL Lab tab
    const sqlLabSettingsTab = screen.getByRole('tab', {
      name: /sql lab/i,
    });

    userEvent.click(sqlLabSettingsTab);

    // Grab all SQL Lab settings by their labels
    // const exposeInSqlLab = screen.getByText('Expose in SQL Lab');
    const exposeInSqlLab = screen.getByRole('checkbox', {
      name: /expose in sql lab/i,
    });

    expect(exposeInSqlLab).not.toBeChecked();
    userEvent.click(exposeInSqlLab);

    // While checked make sure all checkboxes are showing
    expect(exposeInSqlLab).toBeChecked();
    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter(checkbox => !checkbox.checked);

    expect(checkboxes.length).toEqual(4);
  });

  it('renders the schema field when allowCTAS is checked', () => {
    render(<DatabaseModal {...dbProps} />, { useRedux: true });

    // Select Advanced tab
    const advancedTab = screen.getByRole('tab', {
      name: /advanced/i,
    });
    userEvent.click(advancedTab);

    // Select SQL Lab tab
    const sqlLabSettingsTab = screen.getByRole('tab', {
      name: /sql lab/i,
    });
    userEvent.click(sqlLabSettingsTab);
    // Grab CTAS & schema field by their labels
    const allowCTAS = screen.getByLabelText('Allow CREATE TABLE AS');
    const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;

    // While CTAS & CVAS are unchecked, schema field is not visible
    expect(schemaField).not.toHaveClass('open');

    // Check "Allow CTAS" to reveal schema field
    userEvent.click(allowCTAS);
    expect(schemaField).toHaveClass('open');

    // Uncheck "Allow CTAS" to hide schema field again
    userEvent.click(allowCTAS);
    expect(schemaField).not.toHaveClass('open');
  });

  it('renders the schema field when allowCVAS is checked', () => {
    render(<DatabaseModal {...dbProps} />, { useRedux: true });

    // Select Advanced tab
    const advancedTab = screen.getByRole('tab', {
      name: /advanced/i,
    });
    userEvent.click(advancedTab);

    // Select SQL Lab tab
    const sqlLabSettingsTab = screen.getByRole('tab', {
      name: /sql lab/i,
    });
    userEvent.click(sqlLabSettingsTab);
    // Grab CVAS by it's label & schema field
    const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
    const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;

    // While CTAS & CVAS are unchecked, schema field is not visible
    expect(schemaField).not.toHaveClass('open');

    // Check "Allow CVAS" to reveal schema field
    userEvent.click(allowCVAS);
    expect(schemaField).toHaveClass('open');

    // Uncheck "Allow CVAS" to hide schema field again
    userEvent.click(allowCVAS);
    expect(schemaField).not.toHaveClass('open');
  });

  it('renders the schema field when both allowCTAS and allowCVAS are checked', () => {
    render(<DatabaseModal {...dbProps} />, { useRedux: true });

    // Select Advanced tab
    const advancedTab = screen.getByRole('tab', {
      name: /advanced/i,
    });
    userEvent.click(advancedTab);

    // Select SQL Lab tab
    const sqlLabSettingsTab = screen.getByRole('tab', {
      name: /sql lab/i,
    });
    userEvent.click(sqlLabSettingsTab);
    // Grab CTAS and CVAS by their labels, & schema field
    const allowCTAS = screen.getByText('Allow CREATE TABLE AS');
    const allowCVAS = screen.getByText('Allow CREATE VIEW AS');
    const schemaField = screen.getByText('CTAS & CVAS SCHEMA').parentElement;

    // While CTAS & CVAS are unchecked, schema field is not visible
    expect(schemaField).not.toHaveClass('open');

    // Check both "Allow CTAS" and "Allow CVAS" to reveal schema field
    userEvent.click(allowCTAS);
    userEvent.click(allowCVAS);
    expect(schemaField).toHaveClass('open');
    // Uncheck both "Allow CTAS" and "Allow CVAS" to hide schema field again
    userEvent.click(allowCTAS);
    userEvent.click(allowCVAS);

    // Both checkboxes go unchecked, so the field should no longer render
    expect(schemaField).not.toHaveClass('open');
  });

  describe('create database', () => {
    beforeEach(() => {
      fetchMock.post(DATABASE_POST_ENDPOINT, {
        id: 10,
      });
      fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
        databases: [
          {
            engine: 'mysql',
            name: 'MySQL',
            preferred: false,
          },
        ],
      });
    });
    const props = {
      ...dbProps,
      databaseId: null,
      database_name: null,
      sqlalchemy_uri: null,
    };
    it('should show a form when dynamic_form is selected', async () => {
      render(<DatabaseModal {...props} />, { useRedux: true });
      // it should have the correct header text
      const headerText = screen.getByText(/connect a database/i);
      expect(headerText).toBeVisible();

      await screen.findByText(/display name/i);

      // it does not fetch any databases if no id is passed in
      expect(fetchMock.calls(DATABASE_FETCH_ENDPOINT).length).toEqual(0);

      // todo we haven't hooked this up to load dynamically yet so
      // we can't currently test it
    });
    it('should close the modal on save if using the sqlalchemy form', async () => {
      const onHideMock = jest.fn();
      render(<DatabaseModal {...props} onHide={onHideMock} />, {
        useRedux: true,
      });
      // button should be disabled by default
      const submitButton = screen.getByTestId('modal-confirm-button');
      expect(submitButton).toBeDisabled();

      const displayName = screen.getByTestId('database-name-input');
      userEvent.type(displayName, 'MyTestDB');
      expect(displayName.value).toBe('MyTestDB');
      const sqlalchemyInput = screen.getByTestId('sqlalchemy-uri-input');
      userEvent.type(sqlalchemyInput, 'some_url');
      expect(sqlalchemyInput.value).toBe('some_url');

      // button should not be disabled now
      expect(submitButton).toBeEnabled();

      await waitFor(() => {
        userEvent.click(submitButton);
      });
      expect(fetchMock.calls(DATABASE_POST_ENDPOINT)).toHaveLength(1);
      expect(onHideMock).toHaveBeenCalled();
    });
  });

  describe('edit database', () => {
    beforeEach(() => {
      fetchMock.mock(AVAILABLE_DB_ENDPOINT, {
        databases: [
          {
            engine: 'mysql',
            name: 'MySQL',
            preferred: false,
          },
        ],
      });
    });
    it('renders the sqlalchemy form when the sqlalchemy_form configuration method is set', async () => {
      render(<DatabaseModal {...dbProps} />, { useRedux: true });

      // it should have tabs
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toEqual(2);
      expect(tabs[0]).toHaveTextContent('Basic');
      expect(tabs[1]).toHaveTextContent('Advanced');

      // it should have the correct header text
      const headerText = screen.getByText(/edit database/i);
      expect(headerText).toBeVisible();

      // todo add more when this form is built out
    });
    it('renders the dynamic form when the dynamic_form configuration method is set', async () => {
      fetchMock.get(DATABASE_FETCH_ENDPOINT, {
        result: {
          id: 10,
          database_name: 'my database',
          expose_in_sqllab: false,
          allow_ctas: false,
          allow_cvas: false,
          configuration_method: 'dynamic_form',
          parameters: {
            database: 'mydatabase',
          },
        },
      });
      render(<DatabaseModal {...dbProps} />, { useRedux: true });

      await screen.findByText(/todo/i);

      // // it should have tabs
      const tabs = screen.getAllByRole('tab');
      expect(tabs.length).toEqual(2);

      // it should show a TODO for now
      const todoText = screen.getAllByText(/todo/i);
      expect(todoText[0]).toBeVisible();
    });
  });
});
