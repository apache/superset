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
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import {
  DrillByBreadcrumb,
  useDrillByBreadcrumbs,
} from './useDrillByBreadcrumbs';

const BREADCRUMBS_DATA: DrillByBreadcrumb[] = [
  {
    groupby: [{ column_name: 'col1' }, { column_name: 'col2' }],
    filters: [
      { col: 'col1', op: '==', val: 'col1 filter' },
      { col: 'col2', op: '==', val: 'col2 filter' },
    ],
  },
  {
    groupby: [{ column_name: 'col3', verbose_name: 'Column 3' }],
    filters: [{ col: 'col3', op: '==', val: 'col3 filter' }],
  },
  { groupby: [{ column_name: 'col4' }] },
];

test('Render breadcrumbs', () => {
  const { result } = renderHook(() => useDrillByBreadcrumbs(BREADCRUMBS_DATA));
  render(result.current);
  expect(screen.getAllByTestId('drill-by-breadcrumb-item')).toHaveLength(3);
  expect(
    screen.getByText('col1, col2 (col1 filter, col2 filter)'),
  ).toBeInTheDocument();
  expect(screen.getByText('Column 3 (col3 filter)')).toBeInTheDocument();
  expect(screen.getByText('col4')).toBeInTheDocument();
});

test('Call click handler with correct arguments when breadcrumb is clicked', () => {
  const onClick = jest.fn();
  const { result } = renderHook(() =>
    useDrillByBreadcrumbs(BREADCRUMBS_DATA, onClick),
  );
  render(result.current);

  userEvent.click(screen.getByText('col1, col2 (col1 filter, col2 filter)'));
  expect(onClick).toHaveBeenCalledWith(BREADCRUMBS_DATA[0], 0);
  onClick.mockClear();

  userEvent.click(screen.getByText('Column 3 (col3 filter)'));
  expect(onClick).toHaveBeenCalledWith(BREADCRUMBS_DATA[1], 1);
  onClick.mockClear();

  userEvent.click(screen.getByText('col4'));
  expect(onClick).not.toHaveBeenCalled();
  onClick.mockClear();
});
