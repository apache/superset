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
import React from 'react';
import thunk from 'redux-thunk';
import fetchMock from 'fetch-mock';
import configureStore from 'redux-mock-store';
import { Link } from 'react-router-dom';
import {
  render,
  waitFor,
  screen,
  fireEvent,
} from 'spec/helpers/testing-library';
import {
  getDashboardFormData,
  getExploreFormData,
} from 'spec/fixtures/mockExploreFormData';
import { LocalStorageKeys } from 'src/utils/localStorageHelpers';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { URL_PARAMS } from 'src/constants';

import ChartPage from '.';

jest.mock('src/explore/components/ExploreViewContainer', () => () => (
  <div data-test="mock-explore-view-container" />
));
jest.mock('src/dashboard/util/charts/getFormDataWithExtraFilters');

const mockStore = configureStore([thunk]);

describe('ChartPage', () => {
  afterEach(() => {
    fetchMock.reset();
  });

  test('fetches metadata on mount', async () => {
    const store = mockStore({
      explore: {},
    });
    const exploreApiRoute = 'glob:*/api/v1/explore/*';
    const exploreFormData = getExploreFormData({
      viz_type: 'table',
      show_cell_bars: true,
    });
    fetchMock.get(exploreApiRoute, {
      result: { dataset: { id: 1 }, form_data: exploreFormData },
    });
    const { getByTestId } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      store,
    });
    await waitFor(() =>
      expect(fetchMock.calls(exploreApiRoute).length).toBe(1),
    );
    expect(getByTestId('mock-explore-view-container')).toBeInTheDocument();
    expect(store.getActions()).toContainEqual({
      type: 'HYDRATE_EXPLORE',
      data: expect.objectContaining({
        explore: expect.objectContaining({
          form_data: expect.objectContaining({
            show_cell_bars: true,
          }),
        }),
      }),
    });
  });

  describe('with dashboardContextFormData', () => {
    const dashboardPageId = 'mockPageId';

    beforeEach(() => {
      localStorage.setItem(
        LocalStorageKeys.dashboard__explore_context,
        JSON.stringify({
          [dashboardPageId]: {},
        }),
      );
    });

    afterEach(() => {
      localStorage.clear();
      (getFormDataWithExtraFilters as jest.Mock).mockClear();
    });

    test('overrides the form_data with dashboardContextFormData', async () => {
      const store = mockStore({
        explore: {},
      });
      const dashboardFormData = getDashboardFormData();
      (getFormDataWithExtraFilters as jest.Mock).mockReturnValue(
        dashboardFormData,
      );
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const exploreFormData = getExploreFormData();
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: exploreFormData },
      });
      window.history.pushState(
        {},
        '',
        `/?${URL_PARAMS.dashboardPageId.name}=${dashboardPageId}`,
      );
      render(<ChartPage />, {
        useRouter: true,
        useRedux: true,
        store,
      });
      await waitFor(() =>
        expect(fetchMock.calls(exploreApiRoute).length).toBe(1),
      );
      expect(store.getActions()).toContainEqual({
        type: 'HYDRATE_EXPLORE',
        data: expect.objectContaining({
          explore: expect.objectContaining({
            form_data: expect.objectContaining({
              color_scheme: dashboardFormData.color_scheme,
            }),
          }),
        }),
      });
    });

    test('overrides the form_data with exploreFormData when location is updated', async () => {
      const store = mockStore({
        explore: {},
      });
      const dashboardFormData = {
        ...getDashboardFormData(),
        viz_type: 'table',
        show_cell_bars: true,
      };
      (getFormDataWithExtraFilters as jest.Mock).mockReturnValue(
        dashboardFormData,
      );
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const exploreFormData = getExploreFormData({
        viz_type: 'table',
        show_cell_bars: true,
      });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: exploreFormData },
      });
      window.history.pushState(
        {},
        '',
        `/?${URL_PARAMS.dashboardPageId.name}=${dashboardPageId}`,
      );
      render(
        <>
          <Link
            to={`/?${URL_PARAMS.dashboardPageId.name}=${dashboardPageId}&${URL_PARAMS.saveAction.name}=overwrite`}
          >
            Change route
          </Link>
          <ChartPage />
        </>,
        {
          useRouter: true,
          useRedux: true,
          store,
        },
      );
      await waitFor(() =>
        expect(fetchMock.calls(exploreApiRoute).length).toBe(1),
      );
      expect(store.getActions()).toContainEqual({
        type: 'HYDRATE_EXPLORE',
        data: expect.objectContaining({
          explore: expect.objectContaining({
            form_data: expect.objectContaining({
              show_cell_bars: dashboardFormData.show_cell_bars,
            }),
          }),
        }),
      });
      const updatedExploreFormData = {
        ...exploreFormData,
        show_cell_bars: false,
      };
      fetchMock.reset();
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: updatedExploreFormData },
      });
      fireEvent.click(screen.getByText('Change route'));
      await waitFor(() =>
        expect(fetchMock.calls(exploreApiRoute).length).toBe(1),
      );
      expect(store.getActions()).toContainEqual({
        type: 'HYDRATE_EXPLORE',
        data: expect.objectContaining({
          explore: expect.objectContaining({
            form_data: expect.objectContaining({
              show_cell_bars: updatedExploreFormData.show_cell_bars,
            }),
          }),
        }),
      });
    });
  });
});
