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
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';

import React from 'react';
import CssTemplatesListComponent from 'src/pages/CssTemplateList';

// Cast to accept partial mock props in tests
const CssTemplatesList = CssTemplatesListComponent as unknown as React.FC<
  Record<string, any>
>;

const mockStore = configureStore([thunk]);
const store = mockStore({});

const templatesInfoEndpoint = 'glob:*/api/v1/css_template/_info*';
const templatesEndpoint = 'glob:*/api/v1/css_template/?*';
const templateEndpoint = 'glob:*/api/v1/css_template/*';
const templatesRelatedEndpoint = 'glob:*/api/v1/css_template/related/*';

const mocktemplates = Array.from({ length: 3 }, (_, i) => ({
  changed_on_delta_humanized: `${i} day(s) ago`,
  created_by: {
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: new Date().toISOString,
  css: 'css',
  id: i,
  template_name: `template ${i}`,
}));

const mockUser = {
  userId: 1,
};

fetchMock.get(templatesInfoEndpoint, {
  permissions: ['can_write'],
});
fetchMock.get(templatesEndpoint, {
  result: mocktemplates,
  templates_count: 3,
});

fetchMock.delete(templateEndpoint, {});
fetchMock.delete(templatesEndpoint, {});

fetchMock.get(templatesRelatedEndpoint, {
  created_by: {
    count: 0,
    result: [],
  },
});

const renderCssTemplatesList = (props = {}) =>
  render(
    <MemoryRouter>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <CssTemplatesList user={mockUser} {...props} />
      </QueryParamProvider>
    </MemoryRouter>,
    {
      useRedux: true,
      store,
    },
  );

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('CssTemplatesList', () => {
  beforeEach(() => {
    fetchMock.clearHistory();
  });

  test('renders', async () => {
    renderCssTemplatesList();
    expect(await screen.findByText(/css templates/i)).toBeInTheDocument();
  });

  test('renders a SubMenu', async () => {
    renderCssTemplatesList();
    expect(await screen.findByRole('navigation')).toBeInTheDocument();
  });

  test('renders a ListView', async () => {
    renderCssTemplatesList();
    expect(
      await screen.findByTestId('css-templates-list-view'),
    ).toBeInTheDocument();
  });

  test('fetches templates', async () => {
    renderCssTemplatesList();
    await waitFor(() => {
      const calls = fetchMock.callHistory.calls(/css_template\/\?q/);
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toContain(
        'order_column:template_name,order_direction:desc,page:0,page_size:25',
      );
    });
  });

  test('renders Filters', async () => {
    renderCssTemplatesList();
    await screen.findByTestId('css-templates-list-view');
    expect(screen.getByPlaceholderText(/type a value/i)).toBeInTheDocument();
  });

  test('searches', async () => {
    renderCssTemplatesList();

    // Wait for list to load
    await screen.findByTestId('css-templates-list-view');

    // Find and fill search input
    const searchInput = screen.getByPlaceholderText(/type a value/i);
    fireEvent.change(searchInput, { target: { value: 'fooo' } });
    fireEvent.keyDown(searchInput, { key: 'Enter', keyCode: 13 });

    // Wait for search API call
    await waitFor(() => {
      const calls = fetchMock.callHistory.calls(/css_template\/\?q/);
      const searchCall = calls.find(call =>
        call.url.includes('filters:!((col:template_name,opr:ct,value:fooo))'),
      );
      expect(searchCall).toBeTruthy();
    });
  });

  test('deletes', async () => {
    renderCssTemplatesList();

    // Wait for list to load
    await screen.findByTestId('css-templates-list-view');

    // Find and click delete button
    const deleteButtons = await screen.findAllByTestId('delete-action');
    fireEvent.click(deleteButtons[0]);

    // Check delete modal content
    const deleteModal = await screen.findByRole('dialog');
    expect(deleteModal).toHaveTextContent(/permanently delete the template/i);

    // Type DELETE in confirmation input
    const deleteInput = await screen.findByTestId('delete-modal-input');
    fireEvent.change(deleteInput, { target: { value: 'DELETE' } });

    // Click confirm button
    const confirmButton = await screen.findByTestId('modal-confirm-button');
    fireEvent.click(confirmButton);

    // Wait for delete request
    await waitFor(() => {
      expect(
        fetchMock.callHistory.calls(/css_template\/0/, { method: 'DELETE' }),
      ).toHaveLength(1);
    });
  });

  test('shows bulk actions when bulk select is clicked', async () => {
    renderCssTemplatesList();

    // Wait for list to load
    await screen.findByTestId('css-templates-list-view');

    // Click bulk select toggle
    const bulkSelectButton = screen.getByRole('button', {
      name: /bulk select/i,
    });
    fireEvent.click(bulkSelectButton);

    // Wait for bulk select mode to be enabled
    expect(await screen.findByText('0 Selected')).toBeInTheDocument();
  }, 30000);
});
