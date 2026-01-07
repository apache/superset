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
import { isValidElement } from 'react';
import { render, screen } from 'spec/helpers/testing-library';
import { QueryState, type QueryResponse } from '@superset-ui/core';
import QueryStatusBar from '.';

jest.mock('../QueryStateLabel', () => ({
  __esModule: true,
  default: ({ query }: { query: { state: QueryState } }) => (
    <div data-test="query-state-label">{query.state}</div>
  ),
}));

const createMockQuery = (
  overrides: Partial<QueryResponse> = {},
): QueryResponse =>
  ({
    id: 'test-query-id',
    dbId: 1,
    sql: 'SELECT * FROM test',
    sqlEditorId: 'test-editor',
    tab: 'Test Tab',
    ctas: false,
    cached: false,
    progress: 0,
    startDttm: Date.now() - 1000,
    endDttm: undefined,
    state: QueryState.Running,
    tempSchema: null,
    tempTable: null,
    userId: 1,
    executedSql: null,
    rows: 0,
    queryLimit: 100,
    catalog: null,
    schema: 'test_schema',
    errorMessage: null,
    extra: {},
    results: undefined,
    ...overrides,
  }) as QueryResponse;

test('is valid element', () => {
  const query = createMockQuery();
  expect(isValidElement(<QueryStatusBar query={query} />)).toBe(true);
});

test('renders query state label', () => {
  const query = createMockQuery({ state: QueryState.Running });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByTestId('query-state-label')).toBeInTheDocument();
  expect(screen.getByText('Query State:')).toBeInTheDocument();
});

test('renders elapsed time section', () => {
  const query = createMockQuery({ state: QueryState.Running });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('Elapsed:')).toBeInTheDocument();
});

test('renders steps for running query', () => {
  const query = createMockQuery({ state: QueryState.Running, progress: 50 });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('Validate query')).toBeInTheDocument();
  expect(screen.getByText('Connect to engine')).toBeInTheDocument();
  expect(screen.getByText('Running')).toBeInTheDocument();
  expect(screen.getByText('Download to client')).toBeInTheDocument();
  expect(screen.getByText('Finish')).toBeInTheDocument();
});

test('renders steps for pending query', () => {
  const query = createMockQuery({ state: QueryState.Pending });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('Validate query')).toBeInTheDocument();
});

test('returns null when query is successful with results', () => {
  const query = createMockQuery({
    state: QueryState.Success,
    results: {
      displayLimitReached: false,
      columns: [],
      selected_columns: [],
      expanded_columns: [],
      data: [],
      query: { limit: 100 },
    },
  });
  const { container } = render(<QueryStatusBar query={query} />);
  expect(container.firstChild).toBeEmptyDOMElement();
});

test('displays progress percentage when available', () => {
  const query = createMockQuery({
    state: QueryState.Running,
    progress: 75,
  });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('(75%)')).toBeInTheDocument();
});

test('displays progress text when available', () => {
  const query = createMockQuery({
    state: QueryState.Running,
    progress: 50,
    extra: { progress: null, progress_text: 'Processing rows' },
  });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('(50%, Processing rows)')).toBeInTheDocument();
});

test('displays only progress text when no percentage', () => {
  const query = createMockQuery({
    state: QueryState.Running,
    progress: 0,
    extra: { progress: null, progress_text: 'Initializing' },
  });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('(Initializing)')).toBeInTheDocument();
});

test('renders for failed query state', () => {
  const query = createMockQuery({
    state: QueryState.Failed,
    errorMessage: 'Query failed',
  });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByTestId('query-state-label')).toBeInTheDocument();
});

test('renders for stopped query state', () => {
  const query = createMockQuery({ state: QueryState.Stopped });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByTestId('query-state-label')).toBeInTheDocument();
});

test('renders for fetching state', () => {
  const query = createMockQuery({
    state: QueryState.Fetching,
    progress: 100,
  });
  render(<QueryStatusBar query={query} />);
  expect(screen.getByText('Download to client')).toBeInTheDocument();
});
