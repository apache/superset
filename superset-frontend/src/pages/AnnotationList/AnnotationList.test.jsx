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
import thunk from 'redux-thunk';
import configureStore from 'redux-mock-store';
import fetchMock from 'fetch-mock';
import { MemoryRouter } from 'react-router-dom';
import {
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from 'spec/helpers/testing-library';

import AnnotationList from 'src/pages/AnnotationList';
// store needed for withToasts(AnnotationList)
const mockStore = configureStore([thunk]);
const store = mockStore({});

const annotationsEndpoint = 'glob:*/api/v1/annotation_layer/*/annotation*';
const annotationLayerEndpoint = 'glob:*/api/v1/annotation_layer/*';

fetchMock.delete(annotationsEndpoint, {});

const mockannotations = [...new Array(3)].map((_, i) => ({
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user`,
    id: i,
  },
  changed_by: {
    first_name: `user`,
    id: i,
  },
  end_dttm: new Date().toISOString,
  id: i,
  long_descr: `annotation ${i} description`,
  short_descr: `annotation ${i} label`,
  start_dttm: new Date().toISOString,
}));

fetchMock.get(annotationsEndpoint, {
  ids: [2, 0, 1],
  result: mockannotations,
  count: 3,
});

fetchMock.get(annotationLayerEndpoint, {
  id: 1,
  result: { descr: 'annotations test 0', name: 'Test 0' },
});

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useParams: () => ({ annotationLayerId: '1' }),
}));

describe('AnnotationList', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fetchMock.resetHistory();
  });

  const renderList = () =>
    render(
      <MemoryRouter>
        <AnnotationList />
      </MemoryRouter>,
      {
        useRedux: true,
        useQueryParams: true,
        store,
      },
    );

  it('renders', async () => {
    renderList();
    expect(
      await screen.findByText('Annotation Layer Test 0'),
    ).toBeInTheDocument();
  });

  it('renders a SubMenu', async () => {
    renderList();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('renders a ListView', async () => {
    renderList();
    expect(await screen.findByRole('table')).toBeInTheDocument();
  });

  it('fetches annotation layer', async () => {
    renderList();
    await waitFor(() => {
      const callsQ = fetchMock.calls(/annotation_layer\/1/);
      expect(callsQ).toHaveLength(2);
    });
    const callsQ = fetchMock.calls(/annotation_layer\/1/);
    expect(callsQ[1][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/annotation_layer/1"`,
    );
  });

  it('fetches annotations', async () => {
    renderList();
    await waitFor(() => {
      const callsQ = fetchMock.calls(/annotation_layer\/1\/annotation/);
      expect(callsQ).toHaveLength(1);
    });
    const callsQ = fetchMock.calls(/annotation_layer\/1\/annotation/);
    expect(callsQ[0][0]).toMatchInlineSnapshot(
      `"http://localhost/api/v1/annotation_layer/1/annotation/?q=(order_column:short_descr,order_direction:desc,page:0,page_size:25)"`,
    );
  });

  it('deletes an annotation', async () => {
    renderList();

    // Wait for the list to load
    const table = await screen.findByRole('table');

    // Find the first row and click its delete button
    const firstRow = within(table).getAllByRole('row')[1]; // Skip header row
    const deleteButton = within(firstRow).getByLabelText('trash');
    fireEvent.click(deleteButton);

    // Check delete modal content
    expect(
      screen.getByText(/Are you sure you want to delete annotation 0 label?/),
    ).toBeInTheDocument();

    // Type DELETE to confirm
    const input = screen.getByTestId('delete-modal-input');
    fireEvent.change(input, { target: { value: 'DELETE' } });

    // Click confirm button
    const confirmButton = screen.getByRole('button', { name: 'Delete' });
    fireEvent.click(confirmButton);

    // Verify delete request was made
    await waitFor(() => {
      const deleteCalls = fetchMock.calls(/annotation_layer\/1\/annotation/);
      expect(deleteCalls.some(call => call[1].method === 'DELETE')).toBe(true);
    });
  });

  it('shows bulk actions when bulk select is clicked', async () => {
    renderList();

    // Wait for the list to load
    await screen.findByRole('table');

    // Find and click bulk select button
    const bulkSelectButton = await screen.findByTestId(
      'annotation-bulk-select',
    );
    fireEvent.click(bulkSelectButton);

    // After clicking bulk select, a bulk select controls alert should appear
    await waitFor(() => {
      const bulkSelectAlert = screen.getByTestId('bulk-select-controls');
      expect(bulkSelectAlert).toBeInTheDocument();
      expect(screen.getByText('0 Selected')).toBeInTheDocument();
    });
  });
});
