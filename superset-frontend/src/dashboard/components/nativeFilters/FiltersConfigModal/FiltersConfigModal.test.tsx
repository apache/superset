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
import userEvent, { TargetElement } from '@testing-library/user-event';
import { testWithId } from 'src/utils/testUtils';
import { waitFor } from '@testing-library/react';
import {
  FILTERS_CONFIG_MODAL_TEST_ID,
  FiltersConfigModal,
} from './FiltersConfigModal';

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
  const newFilterProps = {
    isOpen: true,
    initialFilterId: undefined,
    createNewOnOpen: true,
    onSave: jest.fn(),
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
            changed_on: '2021-04-12T07:51:28.794931',
            column_name: 'name',
            created_on: '2021-04-12T07:48:43.369373',
            description: null,
            expression: '',
            filterable: true,
            groupby: true,
            id: 334,
            is_active: true,
            is_dttm: false,
            python_date_format: null,
            type: 'VARCHAR(255)',
            uuid: 'f364a616-41a0-4354-9e40-9cd20136d854',
            verbose_name: null,
          },
        ],
        table_name: 'birth_names',
      },
      show_columns: ['id', 'table_name'],
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

  it('Create Select Filter (with datasource and columns)', async () => {
    renderWrapper();

    const FILTER_NAME = 'Select Filter 1';

    userEvent.type(screen.getByTestId(getTestId('name-input')), FILTER_NAME);
    await waitFor(() =>
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument(),
    );
    userEvent.click(
      screen
        .getByTestId(getTestId('datasource-input'))
        .querySelector('.Select__indicators') as TargetElement,
    );
    userEvent.click(screen.getByText('birth_names'));
    userEvent.click(screen.getByText('Select...'));
    userEvent.click(screen.getByText('name'));
    userEvent.click(screen.getByText('Save'));
  });
});
