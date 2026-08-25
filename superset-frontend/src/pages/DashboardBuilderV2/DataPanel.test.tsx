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
import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'spec/helpers/testing-library';
import DataPanel from './DataPanel';

const mount = () => render(<DataPanel />);

test('lists the placeholder datasets, collapsed by default', () => {
  mount();

  expect(screen.getByTestId('data-panel-dataset-sales')).toBeVisible();
  expect(screen.getByTestId('data-panel-dataset-coffee_sales')).toBeVisible();
  expect(
    screen.queryByTestId('data-panel-columns-sales'),
  ).not.toBeInTheDocument();
});

test('expanding a dataset shows its columns', async () => {
  mount();

  const row = screen.getByTestId('data-panel-dataset-sales');
  await userEvent.click(within(row).getByRole('button'));

  const columns = screen.getByTestId('data-panel-columns-sales');
  expect(columns).toHaveTextContent('order_id');
  expect(columns).toHaveTextContent('order_date');
  expect(columns).toHaveTextContent('sales_amount');
  expect(columns).toHaveTextContent('region');
});

test('a second click collapses it again', async () => {
  mount();
  const row = screen.getByTestId('data-panel-dataset-sales');
  const button = within(row).getByRole('button');

  await userEvent.click(button);
  await userEvent.click(button);

  expect(
    screen.queryByTestId('data-panel-columns-sales'),
  ).not.toBeInTheDocument();
});

test('searching narrows the list to matching dataset names', async () => {
  mount();

  await userEvent.type(screen.getByTestId('data-panel-search'), 'coffee');

  expect(screen.getByTestId('data-panel-dataset-coffee_sales')).toBeVisible();
  expect(
    screen.queryByTestId('data-panel-dataset-sales'),
  ).not.toBeInTheDocument();
});

test('a search with no matches says so', async () => {
  mount();

  await userEvent.type(screen.getByTestId('data-panel-search'), 'nope');

  expect(screen.getByTestId('data-panel-empty')).toBeVisible();
});
