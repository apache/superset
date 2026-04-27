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
import { Link } from 'react-router-dom';
import {
  render,
  waitFor,
  screen,
  fireEvent,
} from 'spec/helpers/testing-library';
import { getExploreFormData } from 'spec/fixtures/mockExploreFormData';
import { getDashboardFormData } from 'spec/fixtures/mockDashboardFormData';
import { LocalStorageKeys } from 'src/utils/localStorageHelpers';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { URL_PARAMS } from 'src/constants';
import { JsonObject, VizType } from '@superset-ui/core';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { getParsedExploreURLParams } from 'src/explore/exploreUtils/getParsedExploreURLParams';
import * as messageToastActions from 'src/components/MessageToasts/actions';
import ChartPage from '.';

jest.mock('src/hooks/useUnsavedChangesPrompt', () => ({
  useUnsavedChangesPrompt: jest.fn(),
}));
jest.mock('re-resizable', () => ({
  Resizable: () => <div data-test="mock-re-resizable" />,
}));
jest.mock(
  'src/explore/components/ExploreChartPanel',
  () =>
    ({ exploreState }: { exploreState: JsonObject }) => (
      <div data-test="mock-explore-chart-panel">
        {JSON.stringify(exploreState)}
      </div>
    ),
);
jest.mock('src/dashboard/util/charts/getFormDataWithExtraFilters');
jest.mock('src/explore/exploreUtils/getParsedExploreURLParams', () => ({
  getParsedExploreURLParams: jest.fn(),
}));

// eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
describe('ChartPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (useUnsavedChangesPrompt as jest.Mock).mockReturnValue({
      showModal: false,
      setShowModal: jest.fn(),
      handleConfirmNavigation: jest.fn(),
      handleSaveAndCloseModal: jest.fn(),
    });
  });

  afterEach(() => {
    fetchMock.clearHistory().removeRoutes();
  });

  test('fetches metadata on mount', async () => {
    const exploreApiRoute = 'glob:*/api/v1/explore/*';
    const exploreFormData = getExploreFormData({
      viz_type: VizType.Table,
      show_cell_bars: true,
    });
    fetchMock.get(exploreApiRoute, {
      result: { dataset: { id: 1 }, form_data: exploreFormData },
    });
    const { getByTestId } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
    );
    expect(getByTestId('mock-explore-chart-panel')).toBeInTheDocument();
    expect(getByTestId('mock-explore-chart-panel')).toHaveTextContent(
      JSON.stringify({ show_cell_bars: true }).slice(1, -1),
    );
  });

  test('displays the dataset name and error when it is prohibited', async () => {
    const chartApiRoute = `glob:*/api/v1/chart/*`;
    const exploreApiRoute = 'glob:*/api/v1/explore/*';
    const expectedDatasourceName = 'failed datasource name';
    (getParsedExploreURLParams as jest.Mock).mockReturnValue(
      new Map([['datasource_id', 1]]),
    );
    fetchMock.get(exploreApiRoute, () => {
      class Extra {
        datasource = 123;

        datasource_name = expectedDatasourceName;
      }
      class SupersetSecurityError {
        message = 'You do not have a permission to the table';

        extra = new Extra();
      }
      throw new SupersetSecurityError();
    });
    fetchMock.get(chartApiRoute, 200);
    const { getByTestId } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(
      () =>
        expect(getByTestId('mock-explore-chart-panel')).toHaveTextContent(
          JSON.stringify({ datasource_name: expectedDatasourceName }).slice(
            1,
            -1,
          ),
        ),
      {
        timeout: 5000,
      },
    );
    expect(fetchMock.callHistory.calls(chartApiRoute).length).toEqual(0);
    expect(
      fetchMock.callHistory.calls(exploreApiRoute).length,
    ).toBeGreaterThanOrEqual(1);
  });

  test('fetches the chart api when explore metadata is prohibited and access from the chart link', async () => {
    const expectedChartId = 7;
    const expectedChartName = 'Unauthorized dataset owned chart name';
    (getParsedExploreURLParams as jest.Mock).mockReturnValue(
      new Map([['slice_id', expectedChartId]]),
    );
    const chartApiRoute = `glob:*/api/v1/chart/${expectedChartId}`;
    const exploreApiRoute = 'glob:*/api/v1/explore/*';

    fetchMock.get(exploreApiRoute, () => {
      class Extra {
        datasource = 123;
      }
      class SupersetSecurityError {
        message = 'You do not have a permission to the table';

        extra = new Extra();
      }
      throw new SupersetSecurityError();
    });
    fetchMock.get(chartApiRoute, {
      result: {
        id: expectedChartId,
        slice_name: expectedChartName,
        url: 'chartid',
      },
    });
    const { getByTestId, getByText } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(
      () => expect(fetchMock.callHistory.calls(chartApiRoute).length).toBe(1),
      {
        timeout: 5000,
      },
    );
    expect(
      fetchMock.callHistory.calls(exploreApiRoute).length,
    ).toBeGreaterThanOrEqual(1);
    expect(getByTestId('mock-explore-chart-panel')).toBeInTheDocument();
    expect(getByTestId('mock-explore-chart-panel')).toHaveTextContent(
      JSON.stringify({ datasource: 123 }).slice(1, -1),
    );
    expect(getByText(expectedChartName)).toBeInTheDocument();
  });

  // eslint-disable-next-line no-restricted-globals -- TODO: Migrate from describe blocks
  describe('with dashboardContextFormData', () => {
    const dashboardPageId = 'mockPageId';

    beforeEach(() => {
      localStorage.setItem(
        LocalStorageKeys.DashboardExploreContext,
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
      const { getByTestId } = render(<ChartPage />, {
        useRouter: true,
        useRedux: true,
        useDnd: true,
      });
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );
      expect(getByTestId('mock-explore-chart-panel')).toHaveTextContent(
        JSON.stringify({ color_scheme: dashboardFormData.color_scheme }).slice(
          1,
          -1,
        ),
      );
    });

    test('overrides the form_data with exploreFormData when location is updated', async () => {
      const dashboardFormData = {
        ...getDashboardFormData(),
        viz_type: VizType.Table,
        show_cell_bars: true,
      };
      (getFormDataWithExtraFilters as jest.Mock).mockReturnValue(
        dashboardFormData,
      );
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const exploreFormData = getExploreFormData({
        viz_type: VizType.Table,
        show_cell_bars: true,
      });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: exploreFormData },
      });
      window.history.pushState(
        {},
        '',
        `/explore/?${URL_PARAMS.dashboardPageId.name}=${dashboardPageId}`,
      );
      const { getByTestId } = render(
        <>
          <Link
            to={{
              pathname: '/explore/',
              search: `?${URL_PARAMS.dashboardPageId.name}=${dashboardPageId}`,
              state: { saveAction: 'overwrite' },
            }}
          >
            Change route
          </Link>
          <ChartPage />
        </>,
        {
          useRouter: true,
          useRedux: true,
          useDnd: true,
        },
      );
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );
      expect(getByTestId('mock-explore-chart-panel')).toHaveTextContent(
        JSON.stringify({
          show_cell_bars: dashboardFormData.show_cell_bars,
        }).slice(1, -1),
      );
      const updatedExploreFormData = {
        ...exploreFormData,
        show_cell_bars: false,
      };
      fetchMock.clearHistory().removeRoutes();
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: updatedExploreFormData },
      });
      fireEvent.click(screen.getByText('Change route'));
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );
      expect(getByTestId('mock-explore-chart-panel')).toHaveTextContent(
        JSON.stringify({
          show_cell_bars: updatedExploreFormData.show_cell_bars,
        }).slice(1, -1),
      );
    });

    test('re-fetches explore data on back-button navigation (POP)', async () => {
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const initialFormData = getExploreFormData({
        viz_type: VizType.Table,
        show_cell_bars: true,
      });
      const updatedFormData = getExploreFormData({
        viz_type: VizType.Table,
        show_cell_bars: false,
      });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: initialFormData },
      });
      render(
        <>
          <Link to="/explore/?slice_id=99">Navigate away</Link>
          <ChartPage />
        </>,
        {
          useRouter: true,
          useRedux: true,
          useDnd: true,
        },
      );
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );
      expect(screen.getByTestId('mock-explore-chart-panel')).toHaveTextContent(
        JSON.stringify({ show_cell_bars: true }).slice(1, -1),
      );

      // Navigate forward (PUSH) then simulate back-button (POP)
      fetchMock.clearHistory().removeRoutes();
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: updatedFormData },
      });
      fireEvent.click(screen.getByText('Navigate away'));
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );

      fetchMock.clearHistory().removeRoutes();
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: initialFormData },
      });
      // Simulate back button
      window.history.back();
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );
      expect(screen.getByTestId('mock-explore-chart-panel')).toHaveTextContent(
        JSON.stringify({ show_cell_bars: true }).slice(1, -1),
      );
    });

    test('does not re-fetch explore data when navigating off the /explore route (e.g. "Save & go to dashboard")', async () => {
      // Regression test for sc-104553: "Save & go to dashboard" calls
      // history.push('/superset/dashboard/:id/'). The history.listen in
      // ChartPage previously fired loadExploreData for that PUSH, starting a
      // bogus /api/v1/explore/ request with the dashboard URL's params while
      // the page was in the middle of unmounting.
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const exploreFormData = getExploreFormData({
        viz_type: VizType.Table,
        show_cell_bars: true,
      });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: exploreFormData },
      });
      render(
        <>
          <Link to="/superset/dashboard/5/">Go to dashboard</Link>
          <ChartPage />
        </>,
        {
          useRouter: true,
          useRedux: true,
          useDnd: true,
        },
      );
      // Initial mount fetches once.
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );

      fireEvent.click(screen.getByText('Go to dashboard'));

      // A PUSH to a non-/explore path must not trigger another explore fetch.
      // Give any stray async work a chance to run before asserting.
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1);
    });
  });

  test('does not show error toast when request is aborted on unmount', async () => {
    const addDangerToastSpy = jest.spyOn(messageToastActions, 'addDangerToast');
    const exploreApiRoute = 'glob:*/api/v1/explore/*';
    let rejectRequest: (error: Error) => void;
    const pendingPromise = new Promise((_, reject) => {
      rejectRequest = reject;
    });

    fetchMock.get(exploreApiRoute, () => pendingPromise);

    const { unmount } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });

    // Unmount before the request completes
    unmount();

    // Simulate the aborted request rejection
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    rejectRequest!(abortError);

    // Wait for the rejected request to settle before asserting no toast was shown
    await pendingPromise.catch(() => undefined);
    expect(addDangerToastSpy).not.toHaveBeenCalled();

    addDangerToastSpy.mockRestore();
  });

  test('aborts in-flight request when a new request is made', async () => {
    const addDangerToastSpy = jest.spyOn(messageToastActions, 'addDangerToast');
    const exploreApiRoute = 'glob:*/api/v1/explore/*';
    const exploreFormData = getExploreFormData({
      viz_type: VizType.Table,
      show_cell_bars: true,
    });

    // First request will reject with AbortError when aborted
    let rejectFirstRequest: (error: Error) => void;
    const firstRequestPromise = new Promise((_, reject) => {
      rejectFirstRequest = reject;
    });

    fetchMock.get(exploreApiRoute, () => firstRequestPromise);

    render(
      <>
        <Link to="/explore/?slice_id=99">Navigate</Link>
        <ChartPage />
      </>,
      {
        useRouter: true,
        useRedux: true,
        useDnd: true,
      },
    );

    // Wait for the first request to be initiated
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
    );

    // Set up second request to return immediately
    fetchMock.clearHistory().removeRoutes();
    fetchMock.get(exploreApiRoute, {
      result: { dataset: { id: 1 }, form_data: exploreFormData },
    });

    // Navigate to trigger a new request (which should abort the first)
    fireEvent.click(screen.getByText('Navigate'));

    // Simulate the first request being aborted
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    rejectFirstRequest!(abortError);

    // Wait for the first request to settle before asserting
    await firstRequestPromise.catch(() => undefined);

    // Wait for the second request to complete
    await waitFor(() =>
      expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
    );

    // No error toast should be shown from the aborted first request
    expect(addDangerToastSpy).not.toHaveBeenCalled();

    addDangerToastSpy.mockRestore();
  });
});
