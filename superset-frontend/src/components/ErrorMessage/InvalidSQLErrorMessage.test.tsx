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

import { render } from '@testing-library/react';
import '@testing-library/jest-dom/extend-expect';
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

const setup = (overrides = {}) => (
  <ThemeProvider theme={supersetTheme}>
    <InvalidSQLErrorMessage {...defaultProps} {...overrides} />;
  </ThemeProvider>
);

// Mock the ErrorAlert component
jest.mock('./ErrorAlert', () => ({
  __esModule: true,
  default: ({
    title,
    subtitle,
    level,
    source,
    body,
  }: {
    title: React.ReactNode;
    subtitle?: React.ReactNode;
    level: ErrorLevel;
    source: ErrorSource;
    body: React.ReactNode;
  }) => (
    <div data-test="error-alert">
      <div data-test="title">{title}</div>
      <div data-test="subtitle">{subtitle}</div>
      <div data-test="level">{level}</div>
      <div data-test="source">{source}</div>
      <div data-test="body">{body}</div>
    </div>
  ),
}));

describe('InvalidSQLErrorMessage', () => {
  it('renders ErrorAlert with correct props', () => {
    const { getByTestId } = render(setup());

    expect(getByTestId('error-alert')).toBeInTheDocument();
    expect(getByTestId('title')).toHaveTextContent('Unable to parse SQL');
    expect(getByTestId('subtitle')).toHaveTextContent('Test subtitle');
    expect(getByTestId('level')).toHaveTextContent('error');
    expect(getByTestId('source')).toHaveTextContent('test');
  });

  it('displays the error line and column indicator', () => {
    const { getByTestId } = render(setup());

    const body = getByTestId('body');
    expect(body).toContainHTML('<pre>SELECT * FFROM table</pre>');
    expect(body).toContainHTML('<pre>         ^</pre>');
  });

  it('handles missing line number', () => {
    const { getByTestId } = render(
      setup({
        error: {
          ...defaultProps.error,
          extra: { ...defaultProps.error.extra, line: null },
        },
      }),
    );

    const body = getByTestId('body');
    expect(body).toBeEmptyDOMElement();
  });

  it('handles missing column number', () => {
    const { getByTestId } = render(
      setup({
        error: {
          ...defaultProps.error,
          extra: { ...defaultProps.error.extra, column: null },
        },
      }),
    );

    const body = getByTestId('body');
    expect(body).toHaveTextContent('SELECT * FFROM table');
    expect(body).not.toHaveTextContent('^');
  });
});
