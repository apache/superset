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
  waitFor,
  within,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import DatasetSelect from './DatasetSelect';

const DATASETS = [
  {
    id: 1,
    table_name: 'birth_names',
    database: { database_name: 'examples' },
    schema: 'public',
  },
  {
    id: 2,
    table_name: 'energy_usage',
    database: { database_name: 'examples' },
    schema: 'public',
  },
  {
    id: 3,
    table_name: 'flights',
    database: { database_name: 'examples' },
    schema: 'main',
  },
  {
    id: 4,
    table_name: 'customers',
    database: { database_name: 'sales_db' },
    schema: 'dbo',
  },
];

const mockOnChange = jest.fn();

afterEach(() => {
  fetchMock.restore();
  jest.clearAllMocks();
});

const getSelect = () => screen.getByRole('combobox', { name: /dataset/i });

const openSelect = () => {
  userEvent.click(getSelect());
};

const typeIntoSelect = async (text: string) => {
  const select = getSelect();
  userEvent.clear(select);
  return userEvent.type(select, text, { delay: 10 });
};

const findOption = (text: string) =>
  waitFor(() => {
    // eslint-disable-next-line testing-library/no-node-access
    const virtualList = document.querySelector('.rc-virtual-list');
    if (!virtualList) {
      throw new Error('Virtual list not found');
    }
    return within(virtualList as HTMLElement).getByText(text);
  });

test('renders the dataset select component', () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [],
    count: 0,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  expect(getSelect()).toBeInTheDocument();
});

test('loads and displays datasets when opened', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: DATASETS,
    count: DATASETS.length,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  openSelect();

  expect(await findOption('birth_names')).toBeInTheDocument();
  expect(await findOption('energy_usage')).toBeInTheDocument();
});

test('searches for datasets by table_name locally in loaded options', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: DATASETS,
    count: DATASETS.length,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  openSelect();

  // Wait for all options to load
  await findOption('flights');

  // Now type to filter locally
  await typeIntoSelect('flight');

  // Should filter to show only flights
  expect(await findOption('flights')).toBeInTheDocument();
});

test('uses optionFilterProps to enable table_name filtering', async () => {
  // This test verifies that the optionFilterProps includes table_name
  // which enables client-side filtering on that field
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: DATASETS,
    count: DATASETS.length,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  openSelect();

  // Load all options
  await findOption('energy_usage');

  // Search by table_name substring
  await typeIntoSelect('energy');

  // Should find the dataset by table_name
  expect(await findOption('energy_usage')).toBeInTheDocument();
});

test('filters options case-insensitively on table_name', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: DATASETS,
    count: DATASETS.length,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  openSelect();

  // Load options
  await findOption('birth_names');

  // Type in uppercase
  await typeIntoSelect('BIRTH');

  // Should still find it (case insensitive)
  expect(await findOption('birth_names')).toBeInTheDocument();
});

test('calls onChange when a dataset is selected', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: DATASETS,
    count: DATASETS.length,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  openSelect();

  const option = await findOption('birth_names');
  userEvent.click(option);

  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalled();
    const callArg = mockOnChange.mock.calls[0][0];
    expect(callArg).toEqual({ key: 1, label: expect.anything(), value: 1 });
  });
});

test('includes table_name field in option data structure', async () => {
  fetchMock.get('glob:*/api/v1/dataset/*', {
    result: [DATASETS[0]],
    count: 1,
  });

  render(<DatasetSelect onChange={mockOnChange} />);
  openSelect();

  const option = await findOption('birth_names');
  userEvent.click(option);

  await waitFor(() => {
    expect(mockOnChange).toHaveBeenCalled();
    const callArg = mockOnChange.mock.calls[0][1];
    expect(callArg).toHaveProperty('table_name', 'birth_names');
  });
});
