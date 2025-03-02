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
import SavedQueryPreviewModal from './SavedQueryPreviewModal';

// store needed for withToasts
const mockStore = configureStore([thunk]);
const store = mockStore({});

const mockqueries = [...new Array(3)].map((_, i) => ({
  created_by: {
    id: i,
    first_name: `user`,
    last_name: `${i}`,
  },
  created_on: `${i}-2020`,
  database: {
    database_name: `db ${i}`,
    id: i,
  },
  changed_on_delta_humanized: '1 day ago',
  db_id: i,
  description: `SQL for ${i}`,
  id: i,
  label: `query ${i}`,
  schema: 'public',
  sql: `SELECT ${i} FROM table`,
  sql_tables: [
    {
      catalog: null,
      schema: null,
      table: `${i}`,
    },
  ],
}));

const mockedProps = {
  fetchData: jest.fn(() => {}),
  openInSqlLab: jest.fn(() => {}),
  onHide: () => {},
  queries: mockqueries,
  savedQuery: mockqueries[1],
  show: true,
};

const FETCH_SAVED_QUERY_ENDPOINT = 'glob:*/api/v1/saved_query/*';
const SAVED_QUERY_PAYLOAD = { result: mockqueries[1] };

fetchMock.get(FETCH_SAVED_QUERY_ENDPOINT, SAVED_QUERY_PAYLOAD);

describe('SavedQueryPreviewModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const renderModal = () =>
    render(<SavedQueryPreviewModal {...mockedProps} />, {
      useRedux: true,
      store,
    });

  it('renders the modal with correct title', async () => {
    renderModal();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Query preview')).toBeInTheDocument();
  });

  it('renders sql from saved query', () => {
    renderModal();
    const container = screen.getByTestId('Query preview-modal');
    expect(container).toHaveTextContent(/SELECT 1 FROM table/i);
  });

  it('renders buttons with correct text', () => {
    renderModal();
    expect(
      screen.getByRole('button', { name: 'Previous' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Open in SQL Lab' }),
    ).toBeInTheDocument();
  });

  it('handles next saved query', async () => {
    renderModal();
    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeEnabled();

    fireEvent.click(nextButton);

    await waitFor(() => {
      expect(mockedProps.fetchData).toHaveBeenCalledWith(2);
    });
  });

  it('handles previous saved query', async () => {
    renderModal();
    const prevButton = screen.getByRole('button', { name: 'Previous' });
    expect(prevButton).toBeEnabled();

    fireEvent.click(prevButton);

    await waitFor(() => {
      expect(mockedProps.fetchData).toHaveBeenCalledWith(0);
    });
  });

  it('handles open in sql lab', async () => {
    const { savedQuery } = mockedProps;
    renderModal();
    const openButton = screen.getByRole('button', { name: 'Open in SQL Lab' });

    // Simulate a normal click (no meta key)
    fireEvent.click(openButton, { metaKey: false });

    await waitFor(() => {
      expect(mockedProps.openInSqlLab).toHaveBeenCalledWith(
        savedQuery.id,
        false,
      );
    });

    // Simulate a meta key click
    fireEvent.click(openButton, { metaKey: true });

    await waitFor(() => {
      expect(mockedProps.openInSqlLab).toHaveBeenCalledWith(
        savedQuery.id,
        true,
      );
    });
  });
});
