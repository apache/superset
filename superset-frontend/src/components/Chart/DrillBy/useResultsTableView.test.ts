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

import { renderHook } from '@testing-library/react-hooks';
import {
  render,
  screen,
  userEvent,
  within,
  waitFor,
} from 'spec/helpers/testing-library';
import { useResultsTableView } from './useResultsTableView';

const MOCK_CHART_DATA_RESULT = [
  {
    colnames: ['name', 'sum__num'],
    coltypes: [1, 0],
    data: [
      {
        name: 'Michael',
        sum__num: 2467063,
      },
      {
        name: 'Christopher',
        sum__num: 1725265,
      },
      {
        name: 'David',
        sum__num: 1570516,
      },
      {
        name: 'James',
        sum__num: 1506025,
      },
    ],
  },
  {
    colnames: ['gender', 'year', 'count'],
    coltypes: [1, 0, 0],
    data: [
      {
        gender: 'boy',
        year: 2000,
        count: 1000,
      },
      {
        gender: 'girl',
        year: 2000,
        count: 2000,
      },
    ],
  },
];

test('Displays results table for 1 query', () => {
  const { result } = renderHook(() =>
    useResultsTableView(MOCK_CHART_DATA_RESULT.slice(0, 1), '1__table', true),
  );
  render(result.current, { useRedux: true });
  expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  expect(screen.getByRole('table')).toBeInTheDocument();
  expect(screen.getAllByRole('columnheader')).toHaveLength(2);
  expect(screen.getAllByTestId('table-row')).toHaveLength(4);
});

test('Displays results for 2 queries', async () => {
  const { result } = renderHook(() =>
    useResultsTableView(MOCK_CHART_DATA_RESULT, '1__table', true),
  );
  render(result.current, { useRedux: true });
  const getActiveTabElement = () =>
    document.querySelector('.ant-tabs-tabpane-active') as HTMLElement;

  const tablistElement = screen.getByRole('tablist');
  expect(tablistElement).toBeInTheDocument();
  expect(within(tablistElement).getByText('Results 1')).toBeInTheDocument();
  expect(within(tablistElement).getByText('Results 2')).toBeInTheDocument();

  expect(within(getActiveTabElement()).getByRole('table')).toBeInTheDocument();
  expect(
    within(getActiveTabElement()).getAllByRole('columnheader'),
  ).toHaveLength(2);
  expect(
    within(getActiveTabElement()).getAllByTestId('table-row'),
  ).toHaveLength(4);

  userEvent.click(screen.getByText('Results 2'));

  await waitFor(() => {
    expect(
      within(getActiveTabElement()).getAllByRole('columnheader'),
    ).toHaveLength(3);
  });
  expect(
    within(getActiveTabElement()).getAllByTestId('table-row'),
  ).toHaveLength(2);
});
