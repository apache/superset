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

test('shows no clear icon when sort is at default (options[0])', () => {
  render(
    <CardSortSelect
      options={options}
      onChange={jest.fn()}
      initialSort={[{ id: 'title', desc: false }]}
    />,
  );
  expect(
    screen.queryByTestId('compact-filter-clear'),
  ).not.toBeInTheDocument();
  expect(screen.getByTestId('compact-filter-pill')).toHaveAttribute(
    'aria-expanded',
    'false',
  );
});

test('shows clear icon inside pill when sort is non-default', () => {
  render(
    <CardSortSelect
      options={options}
      onChange={jest.fn()}
      initialSort={[{ id: 'changed_on', desc: true }]}
    />,
  );
  const pill = screen.getByTestId('compact-filter-pill');
  const clearIcon = screen.getByTestId('compact-filter-clear');
  expect(clearIcon).toBeInTheDocument();
  // X must be inside the pill, not a sibling
  expect(pill).toContainElement(clearIcon);
});

test('clear icon resets sort to options[0] and calls onChange', async () => {
  const onChange = jest.fn();
  render(
    <CardSortSelect
      options={options}
      onChange={onChange}
      initialSort={[{ id: 'changed_on', desc: true }]}
    />,
  );
  await userEvent.click(screen.getByTestId('compact-filter-clear'));
  expect(onChange).toHaveBeenCalledWith([{ id: 'title', desc: false }]);
  // After clearing, X should disappear (sort is back at default)
  expect(
    screen.queryByTestId('compact-filter-clear'),
  ).not.toBeInTheDocument();
});

test('shows sort label in pill when non-default sort is active', () => {
  render(
    <CardSortSelect
      options={options}
      onChange={jest.fn()}
      initialSort={[{ id: 'changed_on', desc: true }]}
    />,
  );
  expect(screen.getByText(/sort.*recently modified/i)).toBeInTheDocument();
});
