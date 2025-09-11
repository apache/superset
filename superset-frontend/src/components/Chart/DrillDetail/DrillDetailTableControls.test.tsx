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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import TableControls from './DrillDetailTableControls';

const setFilters = jest.fn();
const onReload = jest.fn();
const setup = (overrides: Record<string, any> = {}) => {
  const props = {
    filters: [],
    setFilters,
    onReload,
    loading: false,
    totalCount: 0,
    ...overrides,
  };
  return render(<TableControls {...props} />);
};
test('should render', () => {
  const { container } = setup();
  expect(container).toBeInTheDocument();
});

test('should show 0 rows', () => {
  setup();
  expect(screen.getByText('0 rows')).toBeInTheDocument();
});

test('should show the correct amount of rows', () => {
  setup({
    totalCount: 10,
  });
  expect(screen.getByText('10 rows')).toBeInTheDocument();
});

test('should render the reload button', () => {
  setup();
  expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
});

test('should show the loading indicator', () => {
  setup({
    loading: true,
  });
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

test('should call onreload', () => {
  setup();
  userEvent.click(screen.getByRole('button', { name: 'Reload' }));
  expect(onReload).toHaveBeenCalledTimes(1);
});

test('should render with filters', () => {
  setup({
    filters: [
      {
        col: 'platform',
        op: '==',
        val: 'GB',
      },
      {
        col: 'lang',
        op: '==',
        val: 'IT',
      },
    ],
  });
  expect(screen.getByText('platform')).toBeInTheDocument();
  expect(screen.getByText('GB')).toBeInTheDocument();
  expect(screen.getByText('lang')).toBeInTheDocument();
  expect(screen.getByText('IT')).toBeInTheDocument();
});

test('should remove the filters on close', () => {
  setup({
    filters: [
      {
        col: 'platform',
        op: '==',
        val: 'GB',
      },
    ],
  });
  expect(screen.getByText('platform')).toBeInTheDocument();
  expect(screen.getByText('GB')).toBeInTheDocument();

  userEvent.click(screen.getByRole('img', { name: 'close' }));

  expect(setFilters).toHaveBeenCalledWith([]);
});
