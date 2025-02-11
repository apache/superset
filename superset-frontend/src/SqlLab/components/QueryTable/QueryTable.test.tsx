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
import QueryTable from 'src/SqlLab/components/QueryTable';
import { runningQuery, successfulQuery, user } from 'src/SqlLab/fixtures';
import { render, screen } from 'spec/helpers/testing-library';

const mockedProps = {
  queries: [runningQuery, successfulQuery],
  displayLimit: 100,
  latestQueryId: 'ryhMUZCGb',
};

describe('QueryTable', () => {
  test('is valid', () => {
    expect(isValidElement(<QueryTable displayLimit={100} />)).toBe(true);
  });

  test('is valid with props', () => {
    expect(isValidElement(<QueryTable {...mockedProps} />)).toBe(true);
  });

  test('renders a proper table', () => {
    const mockStore = configureStore([thunk]);
    const { container } = render(<QueryTable {...mockedProps} />, {
      store: mockStore({ user }),
    });

    expect(screen.getByTestId('listview-table')).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(container.querySelector('.table-condensed')).toBeVisible();
    expect(container.querySelectorAll('table > thead > tr')).toHaveLength(1);
    expect(container.querySelectorAll('table > tbody > tr')).toHaveLength(2);
  });

  test('renders empty table when no queries provided', () => {
    const mockStore = configureStore([thunk]);
    const { container } = render(
      <QueryTable {...{ ...mockedProps, queries: [] }} />,
      { store: mockStore({ user }) },
    );

    expect(screen.getByTestId('listview-table')).toBeVisible();
    expect(screen.getByRole('table')).toBeVisible();
    expect(container.querySelector('.table-condensed')).toBeVisible();
    expect(container.querySelectorAll('table > thead > tr')).toHaveLength(1);
    expect(container.querySelectorAll('table > tbody > tr')).toHaveLength(0);
  });

  test('renders with custom displayLimit', () => {
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
    expect(container.querySelectorAll('table > tbody > tr')).toHaveLength(1);
  });
});
