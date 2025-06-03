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
import {
  render,
  screen,
  fireEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { MemoryRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';

import AnnotationLayersList from 'src/pages/AnnotationLayerList';

const mockStore = configureStore([thunk]);
const store = mockStore({});

const layersInfoEndpoint = 'glob:*/api/v1/annotation_layer/_info*';
const layersEndpoint = 'glob:*/api/v1/annotation_layer/?*';
const layerEndpoint = 'glob:*/api/v1/annotation_layer/*';
const layersRelatedEndpoint = 'glob:*/api/v1/annotation_layer/related/*';

const mocklayers = [...new Array(3)].map((_, i) => ({
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: new Date().toISOString,
  changed_on: new Date().toISOString,
  id: i,
  name: `layer ${i}`,
  desc: 'layer description',
}));

const mockUser = {
  userId: 1,
};

fetchMock.get(layersInfoEndpoint, {
  permissions: ['can_write'],
});
fetchMock.get(layersEndpoint, {
  result: mocklayers,
  layers_count: 3,
});

fetchMock.delete(layerEndpoint, {});
fetchMock.delete(layersEndpoint, {});

fetchMock.get(layersRelatedEndpoint, {
  created_by: {
    count: 0,
    result: [],
  },
});

const renderAnnotationLayersList = (props = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider>
        <AnnotationLayersList user={mockUser} {...props} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      store,
    },
  );

describe('AnnotationLayersList', () => {
  beforeEach(() => {
    fetchMock.resetHistory();
  });

  it('renders', async () => {
    renderAnnotationLayersList();
    expect(await screen.findByText('Annotation layers')).toBeInTheDocument();
  });

  it('renders a SubMenu', async () => {
    renderAnnotationLayersList();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  it('renders a ListView', async () => {
    renderAnnotationLayersList();
    expect(
      await screen.findByTestId('annotation-layers-list-view'),
    ).toBeInTheDocument();
  });

  it('renders a modal', async () => {
    renderAnnotationLayersList();
    const addButton = await screen.findByRole('button', {
      name: /annotation layer$/i,
    });
    fireEvent.click(addButton);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('fetches layers', async () => {
    renderAnnotationLayersList();
    await waitFor(() => {
      const calls = fetchMock.calls(/annotation_layer\/\?q/);
      expect(calls).toHaveLength(1);
      expect(calls[0][0]).toContain(
        'order_column:name,order_direction:desc,page:0,page_size:25',
      );
    });
  });

  it('renders Filters', async () => {
    renderAnnotationLayersList();
    await screen.findByTestId('annotation-layers-list-view');
    expect(screen.getByPlaceholderText(/type a value/i)).toBeInTheDocument();
  });

  it('searches', async () => {
    renderAnnotationLayersList();

    // Wait for list to load
    await screen.findByTestId('annotation-layers-list-view');

    // Find and fill search input
    const searchInput = screen.getByPlaceholderText(/type a value/i);
    fireEvent.change(searchInput, { target: { value: 'foo' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', keyCode: 13 });

    // Wait for search API call
    await waitFor(() => {
      const calls = fetchMock.calls(/annotation_layer\/\?q/);
      const searchCall = calls.find(call =>
        call[0].includes('filters:!((col:name,opr:ct,value:foo))'),
      );
      expect(searchCall).toBeTruthy();
    });
  });

  it('deletes', async () => {
    renderAnnotationLayersList();

    // Wait for list to load
    await screen.findByTestId('annotation-layers-list-view');

    // Find and click delete button
    const deleteButtons = await screen.findAllByTestId('delete-action');
    fireEvent.click(deleteButtons[0]);

    // Check delete modal content
    const deleteModal = await screen.findByRole('dialog');
    expect(deleteModal).toHaveTextContent(/permanently delete the layer/i);

    // Type DELETE in confirmation input
    const deleteInput = await screen.findByTestId('delete-modal-input');
    fireEvent.change(deleteInput, { target: { value: 'DELETE' } });

    // Click confirm button
    const confirmButton = await screen.findByTestId('modal-confirm-button');
    fireEvent.click(confirmButton);

    // Wait for delete request
    await waitFor(() => {
      expect(fetchMock.calls(/annotation_layer\/0/, 'DELETE')).toHaveLength(1);
    });
  });

  it('shows bulk actions when bulk select is clicked', async () => {
    renderAnnotationLayersList();

    // Wait for list to load
    await screen.findByTestId('annotation-layers-list-view');

    // Click bulk select toggle
    const bulkSelectButton = screen.getByText(/bulk select/i);
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select mode to be enabled
    await screen.findByText('0 Selected');
  }, 30000);
});
