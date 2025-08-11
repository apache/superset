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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import fetchMock from 'fetch-mock';
import SqlExpressionValidator from '.';

const mockDatabaseId = 1;
const mockExpression = 'SUM(amount)';
const mockTableName = 'orders';
const mockSchema = 'public';

describe('SqlExpressionValidator', () => {
  beforeEach(() => {
    fetchMock.reset();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  it('renders the validate button', () => {
    render(
      <SqlExpressionValidator
        expression={mockExpression}
        databaseId={mockDatabaseId}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Validate' }),
    ).toBeInTheDocument();
  });

  it('disables the button when expression is empty', () => {
    render(
      <SqlExpressionValidator expression="" databaseId={mockDatabaseId} />,
    );

    expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
  });

  it('disables the button when databaseId is not provided', () => {
    render(<SqlExpressionValidator expression={mockExpression} />);

    expect(screen.getByRole('button', { name: 'Validate' })).toBeDisabled();
  });

  it('shows success message when expression is valid', async () => {
    fetchMock.post(`/api/v1/database/${mockDatabaseId}/validate_expression/`, {
      result: [],
    });

    const onValidationComplete = jest.fn();

    render(
      <SqlExpressionValidator
        expression={mockExpression}
        databaseId={mockDatabaseId}
        onValidationComplete={onValidationComplete}
      />,
    );

    const validateButton = screen.getByRole('button', { name: 'Validate' });
    userEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Expression is valid')).toBeInTheDocument();
    });

    expect(onValidationComplete).toHaveBeenCalledWith(true);
  });

  it('shows error messages when expression has validation errors', async () => {
    const mockErrors = [
      {
        line_number: 1,
        start_column: 5,
        end_column: 10,
        message: 'Invalid syntax near "SELCT"',
      },
    ];

    fetchMock.post(`/api/v1/database/${mockDatabaseId}/validate_expression/`, {
      result: mockErrors,
    });

    const onValidationComplete = jest.fn();

    render(
      <SqlExpressionValidator
        expression="SELCT * FROM users"
        databaseId={mockDatabaseId}
        onValidationComplete={onValidationComplete}
      />,
    );

    const validateButton = screen.getByRole('button', { name: 'Validate' });
    userEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Expression has errors')).toBeInTheDocument();
      expect(
        screen.getByText(/Invalid syntax near "SELCT"/),
      ).toBeInTheDocument();
    });

    expect(onValidationComplete).toHaveBeenCalledWith(false, mockErrors);
  });

  it('sends correct payload with all parameters', async () => {
    fetchMock.post(`/api/v1/database/${mockDatabaseId}/validate_expression/`, {
      result: [],
    });

    render(
      <SqlExpressionValidator
        expression={mockExpression}
        expressionType="metric"
        databaseId={mockDatabaseId}
        tableName={mockTableName}
        schema={mockSchema}
        catalog="main"
      />,
    );

    const validateButton = screen.getByRole('button', { name: 'Validate' });
    userEvent.click(validateButton);

    await waitFor(() => {
      expect(fetchMock.called()).toBe(true);
    });

    const lastCall = fetchMock.lastCall();
    const requestBody = JSON.parse(lastCall![1]!.body as string);

    expect(requestBody).toEqual({
      expression: mockExpression,
      expression_type: 'metric',
      table_name: mockTableName,
      schema: mockSchema,
      catalog: 'main',
    });
  });

  it('handles API errors gracefully', async () => {
    fetchMock.post(
      `/api/v1/database/${mockDatabaseId}/validate_expression/`,
      500,
    );

    const onValidationComplete = jest.fn();

    render(
      <SqlExpressionValidator
        expression={mockExpression}
        databaseId={mockDatabaseId}
        onValidationComplete={onValidationComplete}
      />,
    );

    const validateButton = screen.getByRole('button', { name: 'Validate' });
    userEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Expression has errors')).toBeInTheDocument();
      expect(
        screen.getByText('Failed to validate expression. Please try again.'),
      ).toBeInTheDocument();
    });

    expect(onValidationComplete).toHaveBeenCalledWith(
      false,
      expect.arrayContaining([
        expect.objectContaining({
          message: 'Failed to validate expression. Please try again.',
        }),
      ]),
    );
  });

  it('shows loading state while validating', async () => {
    let resolve: (value: any) => void;
    const promise = new Promise(r => {
      resolve = r;
    });

    fetchMock.post(
      `/api/v1/database/${mockDatabaseId}/validate_expression/`,
      promise,
    );

    render(
      <SqlExpressionValidator
        expression={mockExpression}
        databaseId={mockDatabaseId}
      />,
    );

    const validateButton = screen.getByRole('button', { name: 'Validate' });
    userEvent.click(validateButton);

    // Button should show loading state
    await waitFor(() => {
      expect(validateButton).toHaveClass('ant-btn-loading');
    });

    // Resolve the promise to complete the test
    resolve!({ result: [] });
  });
});
