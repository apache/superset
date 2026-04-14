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

import { ChartCustomization, ChartCustomizationType } from '@superset-ui/core';
import { render, screen, userEvent, waitFor, within } from 'spec/helpers/testing-library';
import { useDispatch, useSelector } from 'react-redux';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import GroupByFilterCard from './GroupByFilterCard';

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));

jest.mock('src/utils/cachedSupersetGet', () => ({
  cachedSupersetGet: jest.fn(),
}));

const dispatchMock = jest.fn();
const mockUseDispatch = useDispatch as jest.Mock;
const mockUseSelector = useSelector as jest.Mock;
const mockCachedSupersetGet = cachedSupersetGet as jest.Mock;
let selectorState: ReturnType<typeof makeSelectorState>;

const customizationItem: ChartCustomization = {
  id: 'CHART_CUSTOMIZATION-multi-select',
  type: ChartCustomizationType.ChartCustomization,
  name: 'Dynamic Group By',
  filterType: 'dynamic_group_by',
  targets: [{ datasetId: 3, column: { name: 'status' } }],
  scope: {
    rootPath: ['ROOT_ID'],
    excluded: [],
  },
  chartsInScope: [42],
  cascadeParentIds: [],
  defaultDataMask: {
    extraFormData: {},
    filterState: {},
  },
  controlValues: {
    canSelectMultiple: true,
  },
  description: 'Select one or more columns',
};

const makeSelectorState = (dataMaskSelected = {}) => ({
  dataMask: dataMaskSelected,
  nativeFilters: {
    filters: {},
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockUseDispatch.mockReturnValue(dispatchMock);
  selectorState = makeSelectorState();
  mockUseSelector.mockImplementation(selector => selector(selectorState));
  mockCachedSupersetGet.mockResolvedValue({
    json: {
      result: {
        table_name: 'orders',
        columns: [
          { column_name: 'status', verbose_name: 'status' },
          { column_name: 'region', verbose_name: 'region' },
          { column_name: 'order_date', verbose_name: 'order_date' },
        ],
      },
    },
  });
});

test('multi-select group by persists selected values and stores a canonical target column name', async () => {
  const onFilterSelectionChange = jest.fn();

  const { rerender } = render(
    <GroupByFilterCard
      customizationItem={customizationItem}
      dataMaskSelected={{}}
      onFilterSelectionChange={onFilterSelectionChange}
    />,
  );

  const combobox = await screen.findByRole('combobox');
  await userEvent.click(combobox);

  const virtualList = await waitFor(() => {
    const list = document.querySelector('.rc-virtual-list');
    if (!list) {
      throw new Error('Virtual list not found');
    }
    return list as HTMLElement;
  });

  await userEvent.click(within(virtualList).getByText('status'));
  await userEvent.click(within(virtualList).getByText('region'));

  await waitFor(() => {
    expect(onFilterSelectionChange).toHaveBeenLastCalledWith(
      customizationItem,
      expect.objectContaining({
        extraFormData: {
          custom_form_data: {
            groupby: ['status', 'region'],
          },
        },
        filterState: {
          label: 'status, region',
          value: ['status', 'region'],
        },
        ownState: {
          column: ['status', 'region'],
        },
      }),
    );
  });

  expect(dispatchMock).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'SET_PENDING_CHART_CUSTOMIZATION',
      pendingCustomization: expect.objectContaining({
        targets: [
          expect.objectContaining({
            datasetId: 3,
            column: { name: 'status' },
          }),
        ],
      }),
    }),
  );

  rerender(
    <GroupByFilterCard
      customizationItem={customizationItem}
      dataMaskSelected={{
        [customizationItem.id]: {
          id: customizationItem.id,
          filterState: {
            label: 'status, region',
            value: ['status', 'region'],
          },
          ownState: {
            column: ['status', 'region'],
          },
          extraFormData: {
            custom_form_data: {
              groupby: ['status', 'region'],
            },
          },
        },
      }}
      onFilterSelectionChange={onFilterSelectionChange}
    />,
  );

  await waitFor(() => {
    expect(
      document.querySelector('.ant-select-selection-item[title="status"]'),
    ).toBeInTheDocument();
    expect(
      document.querySelector('.ant-select-selection-item[title="region"]'),
    ).toBeInTheDocument();
  });
});
