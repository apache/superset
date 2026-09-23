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
  act,
  createStore,
  render,
  waitFor,
  screen,
  fireEvent,
} from 'spec/helpers/testing-library';
import reducerIndex from 'spec/helpers/reducerIndex';
import { getExploreFormData } from 'spec/fixtures/mockExploreFormData';
import { getDashboardFormData } from 'spec/fixtures/mockDashboardFormData';
import { LocalStorageKeys } from 'src/utils/localStorageHelpers';
import getFormDataWithExtraFilters from 'src/dashboard/util/charts/getFormDataWithExtraFilters';
import { URL_PARAMS } from 'src/constants';
import { JsonObject, VizType } from '@superset-ui/core';
import { useUnsavedChangesPrompt } from 'src/hooks/useUnsavedChangesPrompt';
import { getParsedExploreURLParams } from 'src/explore/exploreUtils/getParsedExploreURLParams';
import { toChartStateHistoryState } from 'src/explore/exploreUtils/exploreHistory';
import * as exploreActions from 'src/explore/actions/exploreActions';
import * as hydrateExploreActions from 'src/explore/actions/hydrateExplore';
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

  test('displays an error when the dataset is prohibited', async () => {
    const chartApiRoute = `glob:*/api/v1/chart/*`;
    const exploreApiRoute = 'glob:*/api/v1/explore/*';
    (getParsedExploreURLParams as jest.Mock).mockReturnValue(
      new Map([['datasource_id', 1]]),
    );
    fetchMock.get(exploreApiRoute, () => {
      class Extra {
        is_access_denial = true;
      }
      class SupersetSecurityError {
        message = 'You do not have permission to access this datasource';

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
          'is_access_denial',
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
        is_access_denial = true;
      }
      class SupersetSecurityError {
        message = 'You do not have permission to access this datasource';

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
      'is_access_denial',
    );
    expect(getByText(expectedChartName)).toBeInTheDocument();
  });

  test('keeps the request-access path for an API that predates is_access_denial', async () => {
    // During a rolling deploy this frontend can hit an older API pod, whose
    // denial payload carries `datasource` but not the `is_access_denial` flag.
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

        datasource_name = 'Quarterly Sales';
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
      { timeout: 5000 },
    );
    expect(getByText(expectedChartName)).toBeInTheDocument();
    // the legacy payload still must not name the dataset in Explore's state
    expect(getByTestId('mock-explore-chart-panel')).not.toHaveTextContent(
      'Quarterly Sales',
    );
  });

  test('omits the datasource identity the chart api returns', async () => {
    // `GET /api/v1/chart/<id>` is granted to any chart viewer regardless of
    // dataset access, and its payload names the dataset. On the denial path
    // that identity must not reach Explore's state.
    const expectedChartId = 7;
    (getParsedExploreURLParams as jest.Mock).mockReturnValue(
      new Map([['slice_id', expectedChartId]]),
    );
    const chartApiRoute = `glob:*/api/v1/chart/${expectedChartId}`;
    const exploreApiRoute = 'glob:*/api/v1/explore/*';

    fetchMock.get(exploreApiRoute, () => {
      class Extra {
        is_access_denial = true;
      }
      class SupersetSecurityError {
        message = 'You do not have permission to access this datasource';

        extra = new Extra();
      }
      throw new SupersetSecurityError();
    });
    fetchMock.get(chartApiRoute, {
      result: {
        id: expectedChartId,
        slice_name: 'Unauthorized dataset owned chart name',
        url: 'chartid',
        datasource_id: 123,
        datasource_type: 'table',
        datasource_name_text: 'public.quarterly_sales',
        datasource_url: '/explore/?datasource_type=table&datasource_id=123',
        datasource_uuid: 'a1b2c3d4-0000-0000-0000-000000000000',
        // params/query_context embed the denied dataset's columns and the
        // literal values its filters compare against
        params: JSON.stringify({
          datasource: '123__table',
          groupby: ['secret_customer_column'],
        }),
        query_context: JSON.stringify({
          datasource: { id: 123, type: 'table' },
          queries: [{ filters: [{ col: 'region', val: 'EMEA-confidential' }] }],
        }),
      },
    });
    const { getByTestId } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(
      () => expect(fetchMock.callHistory.calls(chartApiRoute).length).toBe(1),
      { timeout: 5000 },
    );
    const panel = getByTestId('mock-explore-chart-panel');
    await waitFor(() => expect(panel).toHaveTextContent('is_access_denial'));
    expect(panel).not.toHaveTextContent('public.quarterly_sales');
    expect(panel).not.toHaveTextContent('datasource_name_text');
    expect(panel).not.toHaveTextContent('datasource_url');
    expect(panel).not.toHaveTextContent('datasource_uuid');
    expect(panel).not.toHaveTextContent('secret_customer_column');
    expect(panel).not.toHaveTextContent('EMEA-confidential');
  });

  test('does not hydrate explore when unmount aborts the chart metadata request', async () => {
    const expectedChartId = 7;
    (getParsedExploreURLParams as jest.Mock).mockReturnValue(
      new Map([['slice_id', expectedChartId]]),
    );
    const chartApiRoute = `glob:*/api/v1/chart/${expectedChartId}`;
    const exploreApiRoute = 'glob:*/api/v1/explore/*';

    fetchMock.get(exploreApiRoute, () => {
      class Extra {
        is_access_denial = true;
      }
      class SupersetSecurityError {
        message = 'You do not have permission to access this datasource';

        extra = new Extra();
      }
      throw new SupersetSecurityError();
    });

    // hold the chart request open so the unmount lands mid-flight
    let settleChart: (value: unknown) => void;
    const chartPromise = new Promise(resolve => {
      settleChart = resolve;
    });
    fetchMock.get(chartApiRoute, () => chartPromise);

    const hydrateExploreSpy = jest.spyOn(
      hydrateExploreActions,
      'hydrateExplore',
    );
    const { unmount } = render(<ChartPage />, {
      useRouter: true,
      useRedux: true,
      useDnd: true,
    });
    await waitFor(
      () => expect(fetchMock.callHistory.calls(chartApiRoute).length).toBe(1),
      { timeout: 5000 },
    );

    hydrateExploreSpy.mockClear();
    unmount();
    await act(async () => {
      settleChart!({
        result: { id: expectedChartId, slice_name: 'name', url: 'chartid' },
      });
      // the abort rejection reaches the handler only after fetch-retry has
      // exhausted its 3 x 1s attempts
      await new Promise(resolve => {
        setTimeout(resolve, 4000);
      });
    });
    expect(hydrateExploreSpy).not.toHaveBeenCalled();

    hydrateExploreSpy.mockRestore();
  }, 20000);

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
        `/explore/?${URL_PARAMS.dashboardPageId.name}=${dashboardPageId}`,
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

    test('restores the chart state held by the entry on back-button navigation (POP)', async () => {
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const formData = getExploreFormData({
        viz_type: VizType.Table,
        show_cell_bars: true,
      });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: formData },
      });
      fetchMock.post('glob:*/api/v1/chart/data*', { result: [] });
      const setExploreControlsSpy = jest.spyOn(
        exploreActions,
        'setExploreControls',
      );
      render(
        <>
          <Link
            to={{
              pathname: '/explore/',
              search: `?${URL_PARAMS.sliceId.name}=${formData.slice_id}`,
              state: toChartStateHistoryState({
                ...formData,
                show_cell_bars: false,
              }),
            }}
          >
            Change the chart
          </Link>
          <Link to="/explore/?slice_id=99">Navigate away</Link>
          <ChartPage />
        </>,
        { useRouter: true, useRedux: true, useDnd: true },
      );
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );

      // an entry Explore pushed for a chart change, then navigation off it
      fireEvent.click(screen.getByText('Change the chart'));
      fireEvent.click(screen.getByText('Navigate away'));
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(2),
      );
      fetchMock.clearHistory();
      setExploreControlsSpy.mockClear();

      window.history.back();
      await waitFor(() =>
        expect(setExploreControlsSpy).toHaveBeenCalledWith(
          expect.objectContaining({ show_cell_bars: false }),
        ),
      );
      expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(0);
    });

    test('re-fetches when the entry holds the state of another chart', async () => {
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const formData = getExploreFormData({ viz_type: VizType.Table });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: formData },
      });
      const setExploreControlsSpy = jest.spyOn(
        exploreActions,
        'setExploreControls',
      );
      render(
        <>
          <Link
            to={{
              pathname: '/explore/',
              search: `?${URL_PARAMS.sliceId.name}=99`,
              state: toChartStateHistoryState({ ...formData, slice_id: 99 }),
            }}
          >
            Another chart
          </Link>
          <Link to="/explore/?slice_id=100">Navigate away</Link>
          <ChartPage />
        </>,
        { useRouter: true, useRedux: true, useDnd: true },
      );
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );

      fireEvent.click(screen.getByText('Another chart'));
      fireEvent.click(screen.getByText('Navigate away'));
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(2),
      );
      fetchMock.clearHistory();
      setExploreControlsSpy.mockClear();

      window.history.back();
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );
      expect(setExploreControlsSpy).not.toHaveBeenCalled();
    });

    test('re-fetches when the dataset changed after the entry was pushed', async () => {
      const exploreApiRoute = 'glob:*/api/v1/explore/*';
      const loads = () =>
        fetchMock.callHistory.calls(exploreApiRoute, { method: 'GET' }).length;
      const formData = getExploreFormData({ viz_type: VizType.Table });
      fetchMock.get(exploreApiRoute, {
        result: { dataset: { id: 1 }, form_data: formData },
      });
      const store = createStore({}, reducerIndex);
      render(
        <>
          <Link
            to={{
              pathname: '/explore/',
              search: `?${URL_PARAMS.sliceId.name}=${formData.slice_id}`,
              state: toChartStateHistoryState(formData),
            }}
          >
            Change the chart
          </Link>
          <Link to="/explore/?slice_id=99">Navigate away</Link>
          <ChartPage />
        </>,
        { useRouter: true, useRedux: true, useDnd: true, store },
      );
      await waitFor(() => expect(loads()).toBe(1));
      fireEvent.click(screen.getByText('Change the chart'));
      fireEvent.click(screen.getByText('Navigate away'));
      await waitFor(() => expect(loads()).toBe(2));
      fetchMock.clearHistory();

      // the entry predates the swap, so it can't be applied to the chart on screen
      act(() => {
        store.dispatch(
          exploreActions.setExploreControls({
            ...formData,
            datasource: '3__table',
          }),
        );
      });
      window.history.back();
      await waitFor(() => expect(loads()).toBe(1));
    });

    test('does not re-fetch explore data when navigating to a dashboard', async () => {
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
          <Link to="/dashboard/5/">Go to dashboard</Link>
          <ChartPage />
        </>,
        { useRouter: true, useRedux: true, useDnd: true },
      );
      await waitFor(() =>
        expect(fetchMock.callHistory.calls(exploreApiRoute).length).toBe(1),
      );

      fireEvent.click(screen.getByText('Go to dashboard'));

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

    const firstRequestHandler = jest.fn(() => firstRequestPromise);
    fetchMock.get(exploreApiRoute, firstRequestHandler);

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

    // Wait for the initial request cycle to begin. Under CI, mount/navigation
    // setup can trigger more than one explore fetch before history is cleared.
    await waitFor(() => expect(firstRequestHandler).toHaveBeenCalled());

    // Set up second request to return immediately
    fetchMock.clearHistory().removeRoutes();
    const secondRequestHandler = jest.fn(() => ({
      result: { dataset: { id: 1 }, form_data: exploreFormData },
    }));
    fetchMock.get(exploreApiRoute, secondRequestHandler);

    // Navigate to trigger a new request (which should abort the first)
    fireEvent.click(screen.getByText('Navigate'));

    // Simulate the first request being aborted
    const abortError = new Error('The operation was aborted.');
    abortError.name = 'AbortError';
    rejectFirstRequest!(abortError);

    // Wait for the first request to settle before asserting
    await firstRequestPromise.catch(() => undefined);

    // Wait for the replacement request to run after navigation.
    await waitFor(() => expect(secondRequestHandler).toHaveBeenCalled());

    // No error toast should be shown from the aborted first request
    expect(addDangerToastSpy).not.toHaveBeenCalled();

    addDangerToastSpy.mockRestore();
  });
});
