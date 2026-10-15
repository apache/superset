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
  userEvent,
  within,
} from 'spec/helpers/testing-library';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import { FilterableTable } from '.';
import { getCachedSortKey } from './sortResults';

test('displays and sorts exact decimal strings without rounding', async () => {
  setupAGGridModules();
  const smaller = '12345678901234567890.123456789012345678';
  const larger = '12345678901234567890.123456789012345679';
  const ascending = ['-10.50', '0.00', '2.00', '10.50', smaller, larger];
  render(
    <FilterableTable
      orderedColumnKeys={['amount']}
      data={[larger, smaller, '10.50', '2.00', '0.00', '-10.50'].map(
        amount => ({ amount }),
      )}
      height={500}
    />,
  );
  for (const value of ascending) {
    expect(screen.getByText(value)).toBeInTheDocument();
  }
  const header = within(screen.getByRole('grid'))
    .getByText('amount')
    .closest('[role=button]');
  expect(header).not.toBeNull();
  const values = () =>
    Array.from(
      document.querySelectorAll('[role="gridcell"][col-id="amount"]'),
    ).map(cell => cell.textContent);
  await userEvent.click(header!);
  expect(values()).toEqual(ascending);
  await userEvent.click(header!);
  expect(values()).toEqual([...ascending].reverse());
});

test('uses the new rows array for sort-key caching when data changes', async () => {
  setupAGGridModules();
  const orderedColumnKeys = ['amount'];
  const data = [{ amount: '10.50' }, { amount: '2.00' }];
  const { rerender } = render(
    <FilterableTable
      orderedColumnKeys={orderedColumnKeys}
      data={data}
      height={500}
    />,
  );
  const header = within(screen.getByRole('grid'))
    .getByText('amount')
    .closest('[role=button]');
  expect(header).not.toBeNull();
  await userEvent.click(header!);
  expect(getCachedSortKey('10.50', data)).toBeDefined();

  const nextData = [{ amount: '20.50' }, { amount: '3.00' }];
  rerender(
    <FilterableTable
      orderedColumnKeys={orderedColumnKeys}
      data={nextData}
      height={500}
    />,
  );
  expect(
    Array.from(
      document.querySelectorAll('[role="gridcell"][col-id="amount"]'),
    ).map(cell => cell.textContent),
  ).toEqual(['3.00', '20.50']);
  expect(getCachedSortKey('20.50', nextData)).toBeDefined();
});
