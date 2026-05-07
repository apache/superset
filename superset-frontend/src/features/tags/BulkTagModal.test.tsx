/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements. See the NOTICE file
 * distributed with this work for additional information. The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed
 * under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS
 * OF ANY KIND, either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import fetchMock from 'fetch-mock';
import BulkTagModal from './BulkTagModal';

const mockedProps = {
  onHide: jest.fn(),
  refreshData: jest.fn(),
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  show: true,
  selected: [
    { original: { id: 1, name: 'Dashboard 1' } },
    { original: { id: 2, name: 'Dashboard 2' } },
  ],
  resourceName: 'dashboard',
};

describe('BulkTagModal', () => {
  afterEach(() => {
    fetchMock.reset();
    jest.clearAllMocks();
  });

  test('should render', () => {
    const { container } = render(<BulkTagModal {...mockedProps} />);
    expect(container).toBeInTheDocument();
  });

  test('renders the correct title and message', () => {
    render(<BulkTagModal {...mockedProps} />);
    expect(
      screen.getByText(/you are adding tags to 2 dashboards/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Bulk tag')).toBeInTheDocument();
  });

  test('renders tags input field', async () => {
    render(<BulkTagModal {...mockedProps} />);
    const tagsInput = await screen.findByRole('combobox', { name: /tags/i });
    expect(tagsInput).toBeInTheDocument();
  });

  test('calls onHide when the Cancel button is clicked', () => {
    render(<BulkTagModal {...mockedProps} />);
    const cancelButton = screen.getByText('Cancel');
    fireEvent.click(cancelButton);
    expect(mockedProps.onHide).toHaveBeenCalled();
  });

  test('submits the selected tags and shows success toast', async () => {
    fetchMock.post('glob:*/api/v1/tag/bulk_create', {
      result: {
        objects_tagged: [1, 2],
        objects_skipped: [],
      },
    });

    render(<BulkTagModal {...mockedProps} />);

    const tagsInput = await screen.findByRole('combobox', { name: /tags/i });
    fireEvent.change(tagsInput, { target: { value: 'Test Tag' } });
    fireEvent.keyDown(tagsInput, { key: 'Enter', code: 'Enter' });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockedProps.addSuccessToast).toHaveBeenCalledWith(
        'Tagged 2 dashboards',
      );
    });

    expect(mockedProps.refreshData).toHaveBeenCalled();
    expect(mockedProps.onHide).toHaveBeenCalled();
  });

  test('handles API errors gracefully', async () => {
    fetchMock.post('glob:*/api/v1/tag/bulk_create', 500);

    render(<BulkTagModal {...mockedProps} />);

    const tagsInput = await screen.findByRole('combobox', { name: /tags/i });
    fireEvent.change(tagsInput, { target: { value: 'Test Tag' } });
    fireEvent.keyDown(tagsInput, { key: 'Enter', code: 'Enter' });

    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => {
      expect(mockedProps.addDangerToast).toHaveBeenCalledWith(
        'Failed to tag items',
      );
    });
  });
});
