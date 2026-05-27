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
import { CardSortSelect } from './CardSortSelect';

const options = [
  { desc: false, id: 'title', label: 'Alphabetical', value: 'alphabetical' },
  {
    desc: true,
    id: 'changed_on',
    label: 'Recently modified',
    value: 'recently_modified',
  },
  {
    desc: false,
    id: 'changed_on',
    label: 'Least recently modified',
    value: 'least_recently_modified',
  },
];

test('pill always shows "Sort" label with no value suffix and no clear button', () => {
  render(
    <CardSortSelect
      options={options}
      onChange={jest.fn()}
      initialSort={[{ id: 'title', desc: false }]}
    />,
  );
  expect(screen.getByText('Sort')).toBeInTheDocument();
  expect(screen.queryByText(/sort.*alphabetical/i)).not.toBeInTheDocument();
  expect(screen.queryByTestId('compact-filter-clear')).not.toBeInTheDocument();
  expect(screen.getByTestId('compact-filter-pill')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('no clear button even when a non-default sort is active', () => {
  render(
    <CardSortSelect
      options={options}
      onChange={jest.fn()}
      initialSort={[{ id: 'changed_on', desc: true }]}
    />,
  );
  expect(screen.getByText('Sort')).toBeInTheDocument();
  expect(screen.queryByTestId('compact-filter-clear')).not.toBeInTheDocument();
});

test('clicking a sort option from the panel calls onChange with the correct id and desc', async () => {
  const onChange = jest.fn();
  render(
    <CardSortSelect
      options={options}
      onChange={onChange}
      initialSort={[{ id: 'title', desc: false }]}
    />,
  );

  await userEvent.click(screen.getByTestId('compact-filter-pill'));
  expect(screen.getByText('Recently modified')).toBeInTheDocument();

  await userEvent.click(screen.getByText('Recently modified'));

  expect(onChange).toHaveBeenCalledWith([{ id: 'changed_on', desc: true }]);
  // Pill label stays "Sort" — value is in tooltip, not the label
  expect(screen.getByText('Sort')).toBeInTheDocument();
});

test('selecting a different option from the panel calls onChange with correct args', async () => {
  const onChange = jest.fn();
  render(
    <CardSortSelect
      options={options}
      onChange={onChange}
      initialSort={[{ id: 'title', desc: false }]}
    />,
  );

  await userEvent.click(screen.getByTestId('compact-filter-pill'));
  await userEvent.click(screen.getByText('Least recently modified'));

  expect(onChange).toHaveBeenCalledWith([{ id: 'changed_on', desc: false }]);
});
