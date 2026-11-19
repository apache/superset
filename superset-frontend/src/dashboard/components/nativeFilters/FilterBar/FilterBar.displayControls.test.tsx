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

import type { ChartCustomization, DataMask } from '@superset-ui/core';
import { ChartCustomizationType } from '@superset-ui/core';
import fetchMock from 'fetch-mock';
import type { StateFromReducersMapObject } from 'redux';
import {
  act,
  createStore,
  fireEvent,
  render,
  screen,
  waitFor,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterBar from '.';
import type { HorizontalBarProps } from './types';

const mockControl: ChartCustomization = {
  id: 'CHART_CUSTOMIZATION-region',
  type: ChartCustomizationType.ChartCustomization,
  name: 'Group by',
  filterType: 'filter_groupby',
  targets: [{ datasetId: 7, column: { name: 'region' } }],
  scope: { rootPath: ['ROOT_ID'], excluded: [] },
  chartsInScope: [18],
  defaultDataMask: {},
  controlValues: {},
};
const mockSelection: DataMask = {
  filterState: { value: 'region', label: 'Region' },
  extraFormData: { custom_form_data: { groupby: ['region'] } },
};

// Keep the real parent, Apply/Clear buttons, reducers and save thunk; isolate
// the selector UI by invoking its public staging callback.
jest.mock('./Horizontal', () => ({
  __esModule: true,
  default: ({
    actions,
    onPendingCustomizationDataMaskChange,
  }: HorizontalBarProps) => (
    <div>
      <button
        type="button"
        onClick={() =>
          onPendingCustomizationDataMaskChange(mockControl.id, mockSelection)
        }
      >
        Select region
      </button>
      {actions}
    </div>
  ),
}));

const saveUrl = 'glob:*/api/v1/dashboard/1/chart_customizations';

afterEach(() => {
  fetchMock.removeRoute('display-control-save');
  fetchMock.clearHistory();
});

test.each([
  ['editor', true, false, 200, false],
  ['viewer', false, false, 200, false],
  ['viewer without userId', false, true, 200, false],
  ['editor whose permission was revoked', true, false, 403, false],
  ['editor on an externally managed dashboard', true, false, 200, true],
] as const)(
  'display control Apply and Clear for %s',
  async (_, canEdit, withoutUserId, status, isManagedExternally) => {
    const canSave = canEdit && !isManagedExternally;
    fetchMock.put(
      saveUrl,
      { status, body: { result: [mockControl], message: 'FORBIDDEN' } },
      { name: 'display-control-save' },
    );
    const store = createStore(
      {
        ...stateWithoutNativeFilters,
        messageToasts: [],
        user: {
          ...stateWithoutNativeFilters.user,
          userId: withoutUserId ? undefined : 1,
        },
        dashboardInfo: {
          ...stateWithoutNativeFilters.dashboardInfo,
          id: 1,
          dash_edit_perm: canEdit,
          is_managed_externally: isManagedExternally,
          metadata: {
            ...stateWithoutNativeFilters.dashboardInfo.metadata,
            chart_customization_config: [mockControl],
            native_filter_configuration: [],
          },
          pendingChartCustomizations: { [mockControl.id]: mockControl },
        },
        nativeFilters: {
          filters: { [mockControl.id]: mockControl },
          filtersState: {},
        },
        dataMask: {},
      },
      reducerIndex,
    );
    // The shared createStore helper erases the supplied reducer map's type.
    const getState = () =>
      store.getState() as unknown as StateFromReducersMapObject<
        typeof reducerIndex
      >;
    render(<FilterBar orientation={FilterBarOrientation.Horizontal} />, {
      store,
      useRouter: true,
      useDnd: true,
    });
    await act(async () => {
      fireEvent.click(screen.getByText('Select region'));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('filter-bar__apply-button'));
    });
    expect(fetchMock.callHistory.calls(saveUrl)).toHaveLength(canSave ? 1 : 0);
    expect(getState().dataMask[mockControl.id]).toMatchObject(mockSelection);
    expect(getState().dashboardInfo.pendingChartCustomizations).toEqual({});
    await waitFor(() =>
      expect(getState().messageToasts).toHaveLength(status === 403 ? 1 : 0),
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('filter-bar__apply-button'));
    });
    expect(fetchMock.callHistory.calls(saveUrl)).toHaveLength(canSave ? 2 : 0);
    expect(getState().dataMask[mockControl.id]).toBeUndefined();
    if (status === 403) {
      await waitFor(() =>
        expect(getState().messageToasts).toEqual([
          expect.objectContaining({
            text: expect.stringContaining('not saved'),
          }),
          expect.objectContaining({
            text: expect.stringContaining('not saved'),
          }),
        ]),
      );
    } else {
      expect(getState().messageToasts).toEqual([]);
    }
  },
);
