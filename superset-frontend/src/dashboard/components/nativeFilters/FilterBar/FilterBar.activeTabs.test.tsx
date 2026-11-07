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

import { act, render, waitFor } from 'spec/helpers/testing-library';
import { stateWithoutNativeFilters } from 'spec/fixtures/mockStore';
import { BrowserRouter, useHistory } from 'react-router-dom';
import { FilterBarOrientation } from 'src/dashboard/types';
import FilterBar from '.';
import { createFilterKey } from './keyValue';

jest.mock('./keyValue', () => ({
  ...jest.requireActual('./keyValue'),
  createFilterKey: jest.fn(),
}));

jest.useFakeTimers();

afterEach(() => {
  jest.clearAllTimers();
  jest.mocked(createFilterKey).mockReset();
  window.history.replaceState({}, '', '/');
});

test.each(['TAB-b', null])(
  'preserves the latest active_tabs value %s while publishing a filter key',
  async latestTab => {
    window.history.replaceState(
      {},
      '',
      '/dashboard/1/?active_tabs=TAB-a&custom=keep',
    );
    let history!: ReturnType<typeof useHistory>;
    const TestFilterBar = () => {
      history = useHistory();
      return <FilterBar orientation={FilterBarOrientation.Vertical} />;
    };
    let resolveKey!: (key: string | null) => void;
    jest.mocked(createFilterKey).mockReturnValue(
      new Promise<string | null>(resolve => {
        resolveKey = resolve;
      }),
    );
    const { unmount } = render(
      <BrowserRouter>
        <TestFilterBar />
      </BrowserRouter>,
      {
        useRedux: true,
        initialState: {
          ...stateWithoutNativeFilters,
          dashboardInfo: { ...stateWithoutNativeFilters.dashboardInfo, id: 1 },
        },
      },
    );

    try {
      await act(async () => {
        jest.advanceTimersByTime(1000);
      });
      await waitFor(() => expect(createFilterKey).toHaveBeenCalled());
      expect(history.location.search).not.toContain('native_filters_key');
      const params = new URLSearchParams(history.location.search);
      if (latestTab) {
        params.set('active_tabs', latestTab);
      } else {
        params.delete('active_tabs');
      }
      act(() => {
        history.replace({ ...history.location, search: params.toString() });
      });
      await act(async () => {
        resolveKey('fresh-key');
      });

      await waitFor(() => {
        const finalParams = new URLSearchParams(window.location.search);
        expect(finalParams.get('native_filters_key')).toBe('fresh-key');
        expect(finalParams.get('active_tabs')).toBe(latestTab);
        expect(finalParams.get('custom')).toBe('keep');
      });
    } finally {
      await act(async () => {
        resolveKey('fresh-key');
      });
      unmount();
    }
  },
);
