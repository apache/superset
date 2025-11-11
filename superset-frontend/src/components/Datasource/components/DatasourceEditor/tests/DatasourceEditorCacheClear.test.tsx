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
import fetchMock from 'fetch-mock';
import {
  render,
  screen,
  waitFor,
  userEvent,
} from 'spec/helpers/testing-library';
import mockDatasource from 'spec/fixtures/mockDatasource';
import * as cachedSupersetGet from 'src/utils/cachedSupersetGet';
import DatasourceEditor from '..';

jest.mock('src/utils/cachedSupersetGet', () => ({
  ...jest.requireActual('src/utils/cachedSupersetGet'),
  clearDatasetCache: jest.fn(),
}));

const props = {
  datasource: mockDatasource['7__table'],
  addSuccessToast: jest.fn(),
  addDangerToast: jest.fn(),
  onChange: jest.fn(),
};

const routeProps = {
  history: {},
  location: {},
  match: {},
};

const DATASOURCE_ENDPOINT = 'glob:*/datasource/external_metadata_by_name/*';

describe('DatasourceEditor Cache Clearing', () => {
  beforeEach(() => {
    fetchMock.reset();
    fetchMock.get(DATASOURCE_ENDPOINT, {
      columns: [
        { column_name: 'col1', type: 'VARCHAR', is_dttm: false },
        { column_name: 'col2', type: 'INTEGER', is_dttm: false },
      ],
    });
    jest.clearAllMocks();
  });

  afterEach(() => {
    fetchMock.restore();
  });

  test('clears dataset cache when syncing metadata', async () => {
    const clearDatasetCache = jest.spyOn(
      cachedSupersetGet,
      'clearDatasetCache',
    );
    
    const datasourceWithId = {
      ...props.datasource,
      id: 789,
    };

    render(
      <DatasourceEditor
        {...props}
        datasource={datasourceWithId}
        {...routeProps}
      />,
      {
        useRedux: true,
        initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
        useRouter: true,
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
    });

    // Click on the Columns tab first
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    await userEvent.click(columnsTab);

    const syncButton = screen.getByText(/sync columns from source/i);
    expect(syncButton).toBeInTheDocument();
    
    userEvent.click(syncButton);

    await waitFor(() => {
      expect(clearDatasetCache).toHaveBeenCalledWith(789);
    });

    expect(props.addSuccessToast).toHaveBeenCalled();
  });

  test('does not clear cache when sync fails', async () => {
    const clearDatasetCache = jest.spyOn(
      cachedSupersetGet,
      'clearDatasetCache',
    );
    
    fetchMock.get(
      DATASOURCE_ENDPOINT,
      { throws: new Error('Network error') },
      { overwriteRoutes: true },
    );

    const datasourceWithId = {
      ...props.datasource,
      id: 456,
    };

    render(
      <DatasourceEditor
        {...props}
        datasource={datasourceWithId}
        {...routeProps}
      />,
      {
        useRedux: true,
        initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
        useRouter: true,
      },
    );

    await waitFor(() => {
      expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
    });

    // Click on the Columns tab first
    const columnsTab = screen.getByTestId('collection-tab-Columns');
    await userEvent.click(columnsTab);

    const syncButton = screen.getByText(/sync columns from source/i);
    expect(syncButton).toBeInTheDocument();
    
    userEvent.click(syncButton);

    await waitFor(() => {
      expect(props.addDangerToast).toHaveBeenCalled();
    });

    expect(clearDatasetCache).not.toHaveBeenCalled();
  });

  test('clears cache with correct dataset ID during metadata sync', async () => {
    const clearDatasetCache = jest.spyOn(
      cachedSupersetGet,
      'clearDatasetCache',
    );
    
    const testDatasets = [
      { ...props.datasource, id: 111 },
      { ...props.datasource, id: 222 },
      { ...props.datasource, id: 333 },
    ];

    for (const datasource of testDatasets) {
      jest.clearAllMocks();
      
      const { unmount } = render(
        <DatasourceEditor
          {...props}
          datasource={datasource}
          {...routeProps}
        />,
        {
          useRedux: true,
          initialState: { common: { currencies: ['USD', 'GBP', 'EUR'] } },
          useRouter: true,
        },
      );

      await waitFor(() => {
        expect(screen.getByTestId('edit-dataset-tabs')).toBeInTheDocument();
      });

      const syncButton = await screen.findByRole('button', {
        name: /sync columns from source/i,
      });
      
      userEvent.click(syncButton);

      await waitFor(() => {
        expect(clearDatasetCache).toHaveBeenCalledWith(datasource.id);
      });

      unmount();
    }
  });
});