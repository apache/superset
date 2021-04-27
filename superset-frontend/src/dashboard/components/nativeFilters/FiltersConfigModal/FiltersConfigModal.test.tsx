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
import { Preset } from '@superset-ui/core';
import { SelectFilterPlugin, TimeFilterPlugin } from 'src/filters/components';
import { render, cleanup, screen } from 'spec/helpers/testing-library';
import { Provider } from 'react-redux';
import {
  getMockStore,
  mockStore,
  stateWithoutNativeFilters,
} from 'spec/fixtures/mockStore';
import fetchMock from 'fetch-mock';
import React from 'react';
import userEvent from '@testing-library/user-event';
import { testWithId } from 'src/utils/testUtils';
import { waitFor } from '@testing-library/react';
import {
  FILTERS_CONFIG_MODAL_TEST_ID,
  FiltersConfigModal,
} from './FiltersConfigModal';

jest.useFakeTimers();

class MainPreset extends Preset {
  constructor() {
    super({
      name: 'Legacy charts',
      plugins: [
        new TimeFilterPlugin().configure({ key: 'filter_time' }),
        new SelectFilterPlugin().configure({ key: 'filter_select' }),
      ],
    });
  }
}

const getTestId = testWithId<string>(FILTERS_CONFIG_MODAL_TEST_ID, true);

describe('FilterConfigModal', () => {
  new MainPreset().register();
  const onSave = jest.fn();
  const newFilterProps = {
    isOpen: true,
    initialFilterId: undefined,
    createNewOnOpen: true,
    onSave,
    onCancel: jest.fn(),
  };
  fetchMock.get(
    'glob:*/api/v1/dataset/?q=*',
    {
      count: 1,
      ids: [11],
      label_columns: {
        id: 'Id',
        table_name: 'Table Name',
      },
      list_columns: ['id', 'table_name'],
      order_columns: ['table_name'],
      result: [
        {
          id: 11,
          owners: [],
          table_name: 'birth_names',
        },
      ],
    },
    { overwriteRoutes: true },
  );
  fetchMock.get(
    'glob:*/api/v1/dataset/11',
    {
      description_columns: {},
      id: 3,
      label_columns: {
        columns: 'Columns',
        table_name: 'Table Name',
      },
      result: {
        columns: [
          {
            column_name: 'name',
            groupby: true,
            id: 334,
          },
        ],
        table_name: 'birth_names',
      },
      show_columns: ['id', 'table_name'],
    },
    { overwriteRoutes: true },
  );
  fetchMock.post(
    'glob:*/api/v1/chart/data',
    {
      result: [
        {
          status: 'success',
          data: [
            { name: 'Aaron', count: 453 },
            { name: 'Abigail', count: 228 },
            { name: 'Adam', count: 454 },
          ],
          applied_filters: [{ column: 'name' }],
        },
      ],
    },
    { overwriteRoutes: true },
  );

  const renderWrapper = (
    props = newFilterProps,
    state: object = stateWithoutNativeFilters,
  ) =>
    render(
      <Provider
        store={state ? getMockStore(stateWithoutNativeFilters) : mockStore}
      >
        <FiltersConfigModal {...props} />
      </Provider>,
    );

  afterEach(() => {
    cleanup();
    jest.clearAllMocks();
  });

  it('Create Select Filter (with datasource and columns) with specific filter scope', async () => {
    renderWrapper();

    const FILTER_NAME = 'Select Filter 1';

    // fill name
    userEvent.type(screen.getByTestId(getTestId('name-input')), FILTER_NAME);

    // fill dataset
    await waitFor(() =>
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument(),
    );
    userEvent.click(
      screen
        .getByTestId(getTestId('datasource-input'))
        .querySelector('.Select__indicators')!,
    );
    userEvent.click(screen.getByText('birth_names'));

    // fill column
    userEvent.click(screen.getByText('Select...'));
    await waitFor(() =>
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument(),
    );
    userEvent.click(screen.getByText('name'));

    // fill controls
    expect(screen.getByText('Multiple select').parentElement!).toHaveAttribute(
      'class',
      'ant-checkbox-wrapper ant-checkbox-wrapper-checked',
    );
    userEvent.click(screen.getByText('Multiple select'));
    expect(
      screen.getByText('Multiple select').parentElement!,
    ).not.toHaveAttribute(
      'class',
      'ant-checkbox-wrapper ant-checkbox-wrapper-checked',
    );

    // choose default value
    userEvent.click(await screen.findByText('3 options'));
    userEvent.click(screen.getByTitle('Abigail'));

    // fill scoping
    userEvent.click(screen.getByText('Apply to specific panels'));
    userEvent.click(screen.getByText('CHART_ID'));

    // saving
    userEvent.click(screen.getByText('Save'));
    await waitFor(() =>
      expect(onSave.mock.calls[0][0][0]).toEqual(
        expect.objectContaining({
          cascadeParentIds: [],
          controlValues: {
            defaultToFirstItem: false,
            enableEmptyFilter: false,
            inverseSelection: false,
            multiSelect: false,
            sortAscending: true,
          },
          defaultValue: ['Abigail'],
          filterType: 'filter_select',
          isInstant: false,
          name: 'Select Filter 1',
          scope: { excluded: [], rootPath: [] },
          targets: [{ column: { name: 'name' }, datasetId: 11 }],
        }),
      ),
    );
  });
});
