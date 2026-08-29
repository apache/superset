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
import HeaderGroupsControl from './HeaderGroupsControl';
import { HeaderGroupConfig } from './types';

const columnOptions = [
  { value: 'SUM(sales)', label: 'SUM(sales)' },
  { value: 'AVG(sales)', label: 'AVG(sales)' },
  { value: 'SUM(cost)', label: 'SUM(cost)' },
];

const createGroup = (
  overrides: Partial<HeaderGroupConfig> = {},
): HeaderGroupConfig => ({
  id: overrides.id ?? 'group-1',
  label: overrides.label ?? 'Sales',
  columns: overrides.columns ?? ['SUM(sales)'],
  labelAlign: overrides.labelAlign ?? 'center',
  children: overrides.children ?? [],
});

const baseProps = {
  name: 'header_groups',
  label: 'Column groups',
  type: 'HeaderGroupsControl',
  actions: { setControlValue: jest.fn() },
  columnOptions,
};

test('renders an add group action when empty', () => {
  render(
    <HeaderGroupsControl {...baseProps} value={[]} onChange={jest.fn()} />,
  );

  expect(screen.getByText('Add group')).toBeInTheDocument();
});

test('renders existing groups in a compact list and edits them in a popover', async () => {
  const onChange = jest.fn();
  render(
    <HeaderGroupsControl
      {...baseProps}
      value={[createGroup()]}
      onChange={onChange}
    />,
  );

  expect(screen.getByText('Group 1: Sales')).toBeInTheDocument();
  expect(screen.queryByDisplayValue('Sales')).not.toBeInTheDocument();

  await userEvent.click(screen.getByText('Group 1: Sales'));

  expect(screen.getByDisplayValue('Sales')).toBeInTheDocument();
  expect(screen.getByText('Label position')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /Add subgroup/ }));

  expect(onChange).toHaveBeenCalled();
  const nextGroups = onChange.mock.calls.at(-1)?.[0] as HeaderGroupConfig[];
  expect(nextGroups[0].children).toHaveLength(1);
});

test('removes stale columns that are no longer available', () => {
  const onChange = jest.fn();
  render(
    <HeaderGroupsControl
      {...baseProps}
      value={[createGroup({ columns: ['SUM(sales)', 'missing_col'] })]}
      onChange={onChange}
    />,
  );

  expect(onChange).toHaveBeenCalledWith([
    expect.objectContaining({
      columns: ['SUM(sales)'],
    }),
  ]);
});
