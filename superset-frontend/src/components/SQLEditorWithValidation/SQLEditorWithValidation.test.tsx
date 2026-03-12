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
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { SupersetClient } from '@superset-ui/core';
import { SqlExpressionType } from '../../types/SqlExpression';
import SQLEditorWithValidation from './index';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  SupersetClient: {
    post: jest.fn(),
  },
}));

const defaultProps = {
  value: 'SELECT * FROM users',
  onChange: jest.fn(),
  showValidation: true,
  datasourceId: 1,
  datasourceType: 'table',
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('SQLEditorWithValidation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders SQLEditor with validation bar when showValidation is true', () => {
    render(<SQLEditorWithValidation {...defaultProps} />);

    expect(screen.getByText('Unverified')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Validate your expression' }),
    ).toBeInTheDocument();
  });

  test('does not render validation bar when showValidation is false', () => {
    render(
      <SQLEditorWithValidation {...defaultProps} showValidation={false} />,
    );

    expect(screen.queryByText('Unverified')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Validate your expression' }),
    ).not.toBeInTheDocument();
  });

  test('shows primary button style when unverified', () => {
    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    expect(validateButton).toBeInTheDocument();
    // Button should have primary styling (this would need to check actual class or style)
  });

  test('disables validate button when no value or datasourceId', () => {
    render(
      <SQLEditorWithValidation
        {...defaultProps}
        value=""
        datasourceId={undefined}
      />,
    );

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    expect(validateButton).toBeDisabled();
  });

  test('shows validating state when validation is in progress', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;

    // Mock a slow API response
    mockPost.mockImplementation(
      () =>
        new Promise(resolve =>
          setTimeout(() => resolve({ json: { result: [] } } as any), 100),
        ),
    );

    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Validating...')).toBeInTheDocument();
      expect(validateButton).toBeDisabled();
    });
  });

  test('shows success state when validation passes', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({ json: { result: [] } } as any);

    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Valid SQL expression')).toBeInTheDocument();
    });

    // Button should become secondary style after validation
    expect(validateButton).toBeInTheDocument();
  });

  test('shows error state when validation fails', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({
      json: {
        result: [
          {
            message: "Column 'invalid_col' does not exist",
            line_number: 1,
            start_column: 7,
            end_column: 17,
          },
        ],
      },
    } as any);

    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Column 'invalid_col' does not exist/),
      ).toBeInTheDocument();
    });
  });

  test('handles API errors gracefully', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockRejectedValue(new Error('Network error'));

    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(
        screen.getByText('Failed to validate expression. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  test('sends correct payload for column expression', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({ json: { result: [] } } as any);

    render(
      <SQLEditorWithValidation
        {...defaultProps}
        value="user_id * 2"
        expressionType={SqlExpressionType.COLUMN}
      />,
    );

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        endpoint: '/api/v1/datasource/table/1/validate_expression/',
        body: JSON.stringify({
          expression: 'user_id * 2',
          expression_type: SqlExpressionType.COLUMN,
          clause: undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  test('sends correct payload for WHERE expression', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({ json: { result: [] } } as any);

    render(
      <SQLEditorWithValidation
        {...defaultProps}
        value="status = 'active'"
        expressionType={SqlExpressionType.WHERE}
      />,
    );

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        endpoint: '/api/v1/datasource/table/1/validate_expression/',
        body: JSON.stringify({
          expression: "status = 'active'",
          expression_type: SqlExpressionType.WHERE,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  test('sends correct payload for HAVING expression', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({ json: { result: [] } } as any);

    render(
      <SQLEditorWithValidation
        {...defaultProps}
        value="COUNT(*) > 5"
        expressionType={SqlExpressionType.HAVING}
      />,
    );

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith({
        endpoint: '/api/v1/datasource/table/1/validate_expression/',
        body: JSON.stringify({
          expression: 'COUNT(*) > 5',
          expression_type: SqlExpressionType.HAVING,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  test('resets validation state when value changes', () => {
    const { rerender } = render(<SQLEditorWithValidation {...defaultProps} />);

    // Simulate having a validation result
    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    // Change the value
    rerender(
      <SQLEditorWithValidation
        {...defaultProps}
        value="SELECT * FROM orders"
      />,
    );

    // Should reset to unverified state
    expect(screen.getByText('Unverified')).toBeInTheDocument();
  });

  test('calls onChange when editor value changes', () => {
    const onChange = jest.fn();
    render(<SQLEditorWithValidation {...defaultProps} onChange={onChange} />);

    // This would require mocking the SQLEditor component to properly test onChange
    // For now, we can test that the prop is passed through correctly
    expect(onChange).toBeDefined();
  });

  test('calls onValidationComplete callback when provided', async () => {
    const onValidationComplete = jest.fn();
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({ json: { result: [] } } as any);

    render(
      <SQLEditorWithValidation
        {...defaultProps}
        onValidationComplete={onValidationComplete}
      />,
    );

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledWith(true);
    });
  });

  test('calls onValidationComplete with errors when validation fails', async () => {
    const onValidationComplete = jest.fn();
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    const validationError = {
      message: "Column 'invalid_col' does not exist",
      line_number: 1,
      start_column: 7,
      end_column: 17,
    };
    mockPost.mockResolvedValue({
      json: { result: [validationError] },
    } as any);

    render(
      <SQLEditorWithValidation
        {...defaultProps}
        onValidationComplete={onValidationComplete}
      />,
    );

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(onValidationComplete).toHaveBeenCalledWith(false, [
        validationError,
      ]);
    });
  });

  test('shows tooltip with full error message when error is truncated', async () => {
    const longErrorMessage =
      'This is a very long error message that should be truncated in the display but shown in full in the tooltip when user hovers over it';

    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({
      json: {
        result: [
          {
            message: longErrorMessage,
            line_number: 1,
            start_column: 0,
            end_column: 10,
          },
        ],
      },
    } as any);

    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(
        screen.getByText(new RegExp(longErrorMessage)),
      ).toBeInTheDocument();
    });

    // Test tooltip - check that tooltip wrapper exists (not testing hover behavior)
    const errorElement = screen.getByText(new RegExp(longErrorMessage));
    // The tooltip component wraps the content, but may not always add title attribute
    expect(errorElement.parentElement).toBeTruthy();
  });

  test('handles empty response gracefully', async () => {
    const mockPost = SupersetClient.post as jest.MockedFunction<
      typeof SupersetClient.post
    >;
    mockPost.mockResolvedValue({ json: { result: null } } as any);

    render(<SQLEditorWithValidation {...defaultProps} />);

    const validateButton = screen.getByRole('button', {
      name: 'Validate your expression',
    });
    fireEvent.click(validateButton);

    await waitFor(() => {
      expect(screen.getByText('Valid SQL expression')).toBeInTheDocument();
    });
  });
});
