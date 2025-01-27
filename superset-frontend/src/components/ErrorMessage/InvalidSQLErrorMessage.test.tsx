/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ErrorLevel,
  ErrorSource,
  ErrorTypeEnum,
  ThemeProvider,
  supersetTheme,
} from '@superset-ui/core';
import InvalidSQLErrorMessage from './InvalidSQLErrorMessage';

const defaultProps = {
  error: {
    error_type: ErrorTypeEnum.INVALID_SQL_ERROR,
    message: 'Invalid SQL',
    level: 'error' as ErrorLevel,
    extra: {
      sql: 'SELECT * FFROM table',
      line: 1,
      column: 10,
      engine: 'postgresql',
    },
  },
  source: 'test' as ErrorSource,
  subtitle: 'Test subtitle',
};

const renderComponent = (overrides = {}) =>
  render(
    <ThemeProvider theme={supersetTheme}>
      <InvalidSQLErrorMessage {...defaultProps} {...overrides} />
    </ThemeProvider>,
  );

describe('InvalidSQLErrorMessage', () => {
  it('renders the error message with correct properties', () => {
    const { getByText } = renderComponent();

    // Validate main properties
    expect(getByText('Unable to parse SQL')).toBeInTheDocument();
    expect(getByText('Test subtitle')).toBeInTheDocument();
    expect(getByText('SELECT * FFROM table')).toBeInTheDocument();
  });

  it('displays the SQL error line and column indicator', () => {
    const { getByText, container } = renderComponent();

    // Validate SQL and caret indicator
    expect(getByText('SELECT * FFROM table')).toBeInTheDocument();

    // Check for caret (`^`) under the error column
    const preTags = container.querySelectorAll('pre');
    const secondPre = preTags[1];
    expect(secondPre).toHaveTextContent('^');
  });

  it('handles missing line number gracefully', () => {
    const overrides = {
      error: {
        ...defaultProps.error,
        extra: { ...defaultProps.error.extra, line: null },
      },
    };
    const { getByText, container } = renderComponent(overrides);

    // Check that the full SQL is displayed
    expect(getByText('SELECT * FFROM table')).toBeInTheDocument();

    // Validate absence of caret indicator
    const caret = container.querySelector('pre');
    expect(caret).not.toHaveTextContent('^');
  });
  it('handles missing column number gracefully', () => {
    const overrides = {
      error: {
        ...defaultProps.error,
        extra: { ...defaultProps.error.extra, column: null },
      },
    };
    const { getByText, container } = renderComponent(overrides);

    // Check that the full SQL is displayed
    expect(getByText('SELECT * FFROM table')).toBeInTheDocument();

    // Validate absence of caret indicator
    const caret = container.querySelector('pre');
    expect(caret).not.toHaveTextContent('^');
  });
});
