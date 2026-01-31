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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import userEvent from '@testing-library/user-event';
import QueryTable from 'src/SqlLab/components/QueryTable';
import { runningQuery, successfulQuery, user } from 'src/SqlLab/fixtures';
import { render, screen, waitFor } from 'spec/helpers/testing-library';

const mockedProps = {
  queries: [runningQuery, successfulQuery],
  displayLimit: 100,
  latestQueryId: 'ryhMUZCGb',
};

const queryWithResults = {
  ...successfulQuery,
  resultsKey: 'test-results-key-123',
};

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('QueryTable', () => {
  it('is valid', () => {
    expect(isValidElement(<QueryTable displayLimit={100} />)).toBe(true);
  });

  it('is valid with props', () => {
    expect(isValidElement(<QueryTable {...mockedProps} />)).toBe(true);
  });

  it('renders a proper table', () => {
    const mockStore = configureStore([thunk]);
    const { container } = render(<QueryTable {...mockedProps} />, {
      store: mockStore({ user }),
    });

    expect(screen.getByTestId('listview-table')).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(container.querySelector('.table-condensed')).toBeVisible();
    expect(container.querySelectorAll('table > thead > tr')).toHaveLength(1);
    expect(
      container.querySelectorAll(
        'table > tbody > tr:not(.ant-table-measure-row)',
      ),
    ).toHaveLength(2);
  });

  it('renders empty table when no queries provided', () => {
    const mockStore = configureStore([thunk]);
    const { container } = render(
      <QueryTable {...{ ...mockedProps, queries: [] }} />,
      { store: mockStore({ user }) },
    );

    expect(screen.getByTestId('listview-table')).toBeVisible();
    expect(screen.getAllByRole('table')[0]).toBeVisible();
    expect(container.querySelector('.table-condensed')).toBeVisible();
    expect(container.querySelectorAll('table > thead > tr')).toHaveLength(1);
    expect(
      container.querySelectorAll(
        'table > tbody > tr:not(.ant-table-measure-row):not(.ant-table-placeholder)',
      ),
    ).toHaveLength(0);
  });

  it('renders with custom displayLimit', () => {
    const mockStore = configureStore([thunk]);
    const customProps = {
      ...mockedProps,
      displayLimit: 1,
      queries: [runningQuery], // Modify to only include one query
    };
    const { container } = render(<QueryTable {...customProps} />, {
      store: mockStore({ user }),
    });

    expect(screen.getByTestId('listview-table')).toBeVisible();
    expect(
      container.querySelectorAll(
        'table > tbody > tr:not(.ant-table-measure-row)',
      ),
    ).toHaveLength(1);
  });

  it('renders View button when query has resultsKey', () => {
    const mockStore = configureStore([thunk]);
    const propsWithResults = {
      ...mockedProps,
      columns: ['started', 'duration', 'rows', 'results'],
      queries: [queryWithResults],
    };
    render(<QueryTable {...propsWithResults} />, {
      store: mockStore({ user, sqlLab: { queries: {} } }),
    });

    expect(screen.getByRole('button', { name: /view/i })).toBeInTheDocument();
  });

  it('does not render View button when query has no resultsKey', () => {
    const mockStore = configureStore([thunk]);
    const queryWithoutResults = {
      ...successfulQuery,
      resultsKey: null,
    };
    const propsWithoutResults = {
      ...mockedProps,
      columns: ['started', 'duration', 'rows', 'results'],
      queries: [queryWithoutResults],
    };
    render(<QueryTable {...propsWithoutResults} />, {
      store: mockStore({ user, sqlLab: { queries: {} } }),
    });

    expect(
      screen.queryByRole('button', { name: /view/i }),
    ).not.toBeInTheDocument();
  });

  it('clicking View button opens data preview modal', async () => {
    const mockStore = configureStore([thunk]);
    const propsWithResults = {
      ...mockedProps,
      columns: ['started', 'duration', 'rows', 'results'],
      queries: [queryWithResults],
    };
    render(<QueryTable {...propsWithResults} />, {
      store: mockStore({
        user,
        sqlLab: {
          queries: {
            [queryWithResults.id]: queryWithResults,
          },
        },
      }),
    });

    const viewButton = screen.getByRole('button', { name: /view/i });
    await userEvent.click(viewButton);

    expect(await screen.findByText('Data preview')).toBeInTheDocument();
  });

  it('modal closes when exiting', async () => {
    const mockStore = configureStore([thunk]);
    const propsWithResults = {
      ...mockedProps,
      columns: ['started', 'duration', 'rows', 'results'],
      queries: [queryWithResults],
    };
    render(<QueryTable {...propsWithResults} />, {
      store: mockStore({
        user,
        sqlLab: {
          queries: {
            [queryWithResults.id]: queryWithResults,
          },
        },
      }),
    });

    const viewButton = screen.getByRole('button', { name: /view/i });
    await userEvent.click(viewButton);

    expect(await screen.findByText('Data preview')).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: /close/i });
    await userEvent.click(closeButton);

    await waitFor(() => {
      expect(screen.queryByText('Data preview')).not.toBeInTheDocument();
    });
  });
});
