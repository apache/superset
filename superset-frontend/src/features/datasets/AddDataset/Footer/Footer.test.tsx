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
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import Footer from 'src/features/datasets/AddDataset/Footer';

const mockHistoryPush = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useHistory: () => ({
    push: mockHistoryPush,
  }),
}));

// Mock the API call
const mockCreateResource = jest.fn();
jest.mock('src/views/CRUD/hooks', () => ({
  useSingleViewResource: () => ({
    createResource: mockCreateResource,
  }),
}));

const mockedProps = {
  url: 'realwebsite.com',
};

const mockPropsWithDataset = {
  url: 'realwebsite.com',
  datasetObject: {
    db: {
      id: '1',
      database_name: 'examples',
    },
    owners: [1, 2, 3],
    schema: 'public',
    dataset_name: 'Untitled',
    table_name: 'real_info',
  },
  hasColumns: true,
};

describe('Footer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('renders a Footer with a cancel button and a disabled create button', () => {
    render(<Footer {...mockedProps} />, { useRedux: true });

    const saveButton = screen.getByRole('button', {
      name: /Cancel/i,
    });

    const createButton = screen.getByRole('button', {
      name: /Create dataset and create chart/i,
    });

    expect(saveButton).toBeVisible();
    expect(createButton).toBeDisabled();
  });

  test('renders a Create Dataset dropdown button when a table is selected', () => {
    render(<Footer {...mockPropsWithDataset} />, { useRedux: true });

    const createButton = screen.getByRole('button', {
      name: /Create dataset and create chart/i,
    });

    expect(createButton).toBeEnabled();

    // Check that it's a dropdown button with the correct text
    expect(createButton).toHaveTextContent('Create dataset and create chart');

    // Check for the dropdown arrow
    const dropdownArrow = screen.getByRole('img', { hidden: true });
    expect(dropdownArrow).toBeInTheDocument();
  });

  test('create button becomes disabled when table already has a dataset', () => {
    render(<Footer datasets={['real_info']} {...mockPropsWithDataset} />, {
      useRedux: true,
    });

    const createButton = screen.getByRole('button', {
      name: /Create dataset and create chart/i,
    });

    expect(createButton).toBeDisabled();
  });

  test('shows dropdown menu when dropdown arrow is clicked', async () => {
    render(<Footer {...mockPropsWithDataset} />, { useRedux: true });

    // Find and click the dropdown trigger (the arrow part)
    const dropdownTrigger = screen.getByRole('button', { name: 'down' });
    userEvent.click(dropdownTrigger);

    // Check that the dropdown menu option is visible
    await waitFor(() => {
      expect(screen.getByText('Create dataset only')).toBeVisible();
    });
  });

  test('navigates to chart creation when main button is clicked', async () => {
    mockCreateResource.mockResolvedValue(123); // Mock successful dataset creation

    render(<Footer {...mockPropsWithDataset} />, { useRedux: true });

    const createButton = screen.getByRole('button', {
      name: /Create dataset and create chart/i,
    });

    userEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateResource).toHaveBeenCalledWith({
        database: '1',
        catalog: undefined,
        schema: 'public',
        table_name: 'real_info',
      });
      expect(mockHistoryPush).toHaveBeenCalledWith(
        '/chart/add/?dataset=real_info',
      );
    });
  });

  test('navigates to dataset list when "Create dataset only" menu option is clicked', async () => {
    mockCreateResource.mockResolvedValue(123);

    render(<Footer {...mockPropsWithDataset} />, { useRedux: true });

    // Open dropdown menu
    const dropdownTrigger = screen.getByRole('button', { name: 'down' });
    userEvent.click(dropdownTrigger);

    // Click the "Create dataset only" option
    await waitFor(() => {
      const datasetOnlyOption = screen.getByText('Create dataset only');
      userEvent.click(datasetOnlyOption);
    });

    await waitFor(() => {
      expect(mockCreateResource).toHaveBeenCalledWith({
        database: '1',
        catalog: undefined,
        schema: 'public',
        table_name: 'real_info',
      });
      expect(mockHistoryPush).toHaveBeenCalledWith('/tablemodelview/list/');
    });
  });

  test('handles dataset creation failure gracefully', async () => {
    mockCreateResource.mockResolvedValue(null); // Mock failed dataset creation

    render(<Footer {...mockPropsWithDataset} />, { useRedux: true });

    const createButton = screen.getByRole('button', {
      name: /Create dataset and create chart/i,
    });

    userEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateResource).toHaveBeenCalled();
      // Should not navigate if creation failed
      expect(mockHistoryPush).not.toHaveBeenCalled();
    });
  });

  test('passes correct data to createResource with catalog', async () => {
    const mockPropsWithCatalog = {
      ...mockPropsWithDataset,
      datasetObject: {
        ...mockPropsWithDataset.datasetObject,
        catalog: 'test_catalog',
      },
    };

    mockCreateResource.mockResolvedValue(456);

    render(<Footer {...mockPropsWithCatalog} />, { useRedux: true });

    const createButton = screen.getByRole('button', {
      name: /Create dataset and create chart/i,
    });

    userEvent.click(createButton);

    await waitFor(() => {
      expect(mockCreateResource).toHaveBeenCalledWith({
        database: '1',
        catalog: 'test_catalog',
        schema: 'public',
        table_name: 'real_info',
      });
    });
  });
});
