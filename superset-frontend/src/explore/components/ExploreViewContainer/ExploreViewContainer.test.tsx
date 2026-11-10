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

// Mock isMatrixifyEnabled before loading any modules
import fetchMock from 'fetch-mock';
import type { ReactNode } from 'react';
import {
  getChartControlPanelRegistry,
  getChartMetadataRegistry,
  ChartMetadata,
  VizType,
} from '@superset-ui/core';
import { QUERY_MODE_REQUISITES } from 'src/explore/constants';
import { URL_PARAMS } from 'src/constants';
import { getUrlParam } from 'src/utils/urlUtils';
import { MemoryRouter, Route, Router } from 'react-router-dom';
import type { RouteComponentProps } from 'react-router-dom';
import { createMemoryHistory } from 'history';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  createStore,
} from 'spec/helpers/testing-library';
import { Store } from '@reduxjs/toolkit';
import reducerIndex from 'spec/helpers/reducerIndex';
import * as exploreActions from 'src/explore/actions/exploreActions';
import * as chartActions from 'src/components/Chart/chartAction';
import * as datasourceActions from 'src/dashboard/actions/datasources';
import type { ExplorePageState } from 'src/explore/types';
import { ViewLocations } from 'src/core/viewLocations';
import { commands } from 'src/core/commands';
import {
  RELOAD_COMMAND,
  SHOW_HELD_VERSION_COMMAND,
} from 'src/explore/exploreCommands';
import {
  onHeldVersion,
  DOCKED_PANEL_SLOT,
  HELD_VERSION_SLOT,
  type HeldVersionState,
} from 'src/explore/heldVersionChannel';
import ExploreViewContainer from '.';

jest.doMock('@superset-ui/core', () => ({
  __esModule: true,
  ...jest.requireActual('@superset-ui/core'),
  isMatrixifyEnabled: jest.fn(() => false),
}));

const reduxState = {
  explore: {
    controls: {
      datasource: { value: '1__table' },
      viz_type: { value: VizType.Table },
    },
    datasource: {
      id: 1,
      type: 'table',
      columns: [{ is_dttm: false }],
      metrics: [{ id: 1, metric_name: 'count' }],
    },
    isStarred: false,
    slice: {
      slice_id: 1,
    },
    metadata: {
      created_on_humanized: 'a week ago',
      changed_on_humanized: '2 days ago',
      created_by: 'John Doe',
      changed_by: 'John Doe',
      dashboards: [{ id: 1, dashboard_title: 'Test' }],
    },
  },
  charts: {
    1: {
      id: 1,
      latestQueryFormData: {
        datasource: '1__table',
        viz_type: VizType.Table,
      },
    },
  },
  user: {
    userId: 1,
  },
  common: { conf: { SUPERSET_WEBSERVER_TIMEOUT: 60 } },
  datasources: {
    '1__table': {
      id: 1,
      type: 'table',
      columns: [{ is_dttm: false }],
      metrics: [{ id: 1, metric_name: 'count' }],
    },
  },
};

const KEY = 'aWrs7w29sd';
const SEARCH = `?form_data_key=${KEY}&dataset_id=1`;

jest.mock(
  'src/explore/components/ExploreChartPanel/useResizeDetectorByObserver',
  () => ({
    __esModule: true,
    default: () => ({ height: 100, width: 100 }),
  }),
);

jest.mock('re-resizable', () => ({
  Resizable: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

jest.mock('../ExploreChartPanel', () => ({
  __esModule: true,
  default: ({
    standalone,
    onQuery,
  }: {
    standalone?: number;
    onQuery?: () => void;
  }) => {
    const { useEffect, useRef } = jest.requireActual('react');
    const { ExploreStandaloneMode } = jest.requireActual(
      'src/explore/constants',
    );
    const hasQueried = useRef(false);

    useEffect(() => {
      if (!hasQueried.current) {
        hasQueried.current = true;
        onQuery?.();
      }
    }, [onQuery]);

    // Distinct markers per mode so a test can tell mode 2 from mode 0: both
    // render the editor, and asserting only the absence of `standalone-app`
    // would pass for either.
    const marker =
      standalone === ExploreStandaloneMode.HideNav
        ? 'standalone-app'
        : standalone === ExploreStandaloneMode.HideNavShowControls
          ? 'explore-chart-panel-hide-nav'
          : 'explore-chart-panel';

    return <div data-test={marker} />;
  },
}));

jest.mock('../ControlPanelsContainer', () => ({
  __esModule: true,
  default: ({
    onQuery,
    buttonErrorMessage,
    errorMessage,
    chartIsStale,
  }: {
    onQuery: () => void;
    buttonErrorMessage?: ReactNode;
    errorMessage?: ReactNode;
    chartIsStale?: boolean;
  }) => {
    const { RunQueryButton } = jest.requireActual('../RunQueryButton');
    const message = buttonErrorMessage ?? errorMessage;

    return (
      <div
        data-test="control-panels-container"
        data-stale={String(!!chartIsStale)}
        data-has-button-error={String(!!buttonErrorMessage)}
        data-has-data-tab-error={String(!!errorMessage)}
      >
        {/* The real button, wired like ControlPanelsContainer wires it. It is
            never in the loading state here: mounting queues a query and no
            chart panel exists to resolve it, so the store stays 'loading'.
            The stop path is therefore unreachable and its props are inert. */}
        <RunQueryButton
          onQuery={onQuery}
          onStop={() => undefined}
          errorMessage={buttonErrorMessage || errorMessage}
          loading={false}
          isNewChart={false}
          canStopQuery={false}
          chartIsStale={!!chartIsStale}
        />
        {message && (
          <>
            <button type="button" data-test="query-error-tooltip-trigger">
              !
            </button>
            <div role="tooltip">{message}</div>
          </>
        )}
      </div>
    );
  },
}));

jest.mock('../DatasourcePanel', () => ({
  __esModule: true,
  default: () => <div data-test="datasource-panel" />,
}));

jest.mock('../ExploreChartHeader', () => ({
  __esModule: true,
  default: () => <div data-test="explore-chart-header" />,
}));

// Records the locations Explore offers to extensions. The slot renders a
// fragment, and nothing at all when no extension contributes to it, so there
// is no node to find: deleting the one line that lays it out would otherwise
// be invisible to every test here.
const offeredViewIds: string[] = [];
jest.mock('src/components/ViewListExtension', () => ({
  __esModule: true,
  default: ({ viewId }: { viewId: string }) => {
    offeredViewIds.push(viewId);
    return null;
  },
}));

jest.mock('../SaveModal', () => ({
  __esModule: true,
  default: () => <div data-test="save-modal" />,
}));

jest.mock('lodash', () => {
  const debounce = <T extends (...args: never[]) => unknown>(func: T) => {
    const debounced = (...args: Parameters<T>) => func(...args);
    debounced.cancel = jest.fn();
    debounced.flush = jest.fn();
    return debounced;
  };

  return {
    __esModule: true,
    ...jest.requireActual('lodash'),
    debounce,
  };
});

jest.mock('lodash/debounce', () => ({
  __esModule: true,
  default: <T extends (...args: never[]) => unknown>(func: T) => {
    const debounced = (...args: Parameters<T>) => func(...args);
    debounced.cancel = jest.fn();
    debounced.flush = jest.fn();
    return debounced;
  },
}));

fetchMock.post('glob:*/api/v1/explore/form_data*', { key: KEY });
fetchMock.put('glob:*/api/v1/explore/form_data*', { key: KEY });
fetchMock.get('glob:*/api/v1/explore/form_data*', {});
fetchMock.get('glob:*/api/v1/chart/favorite_status*', {
  result: [{ value: true }],
});
fetchMock.get('glob:*/api/v1/chart/*', {
  result: {},
});

const defaultPath = '/explore/';

afterEach(() => {
  fetchMock.clearHistory();
  jest.restoreAllMocks();
});

const renderWithRouter = ({
  search = '',
  overridePathname,
  initialState = reduxState,
  store,
  history: existingHistory,
}: {
  search?: string;
  overridePathname?: string;
  initialState?: object;
  store?: Store;
  history?: ReturnType<typeof createMemoryHistory>;
} = {}) => {
  const path = overridePathname ?? defaultPath;
  jest.spyOn(window, 'location', 'get').mockReturnValue({
    pathname: path,
    search,
  } as Location);
  const history =
    existingHistory ??
    createMemoryHistory({ initialEntries: [`${path}${search}`] });
  const result = render(
    <Router history={history}>
      <Route>
        <ExploreViewContainer />
      </Route>
    </Router>,
    { useRedux: true, useDnd: true, initialState, store },
  );
  return { ...result, history };
};

test('fetches datasource metadata when the datasource changes', async () => {
  const datasourceKey = '2__table';
  const initialState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      form_data: {
        datasource: '1__table',
        viz_type: VizType.Table,
        metrics: [],
      },
    },
  };
  fetchMock.get(
    `glob:*/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
    {
      id: 2,
      type: 'table',
      columns: [],
      metrics: [],
    },
  );
  const store = createStore(initialState, reducerIndex);
  renderWithRouter({ initialState, store: store as Store });

  act(() => {
    store.dispatch(
      exploreActions.setControlValue('datasource', datasourceKey, []),
    );
  });

  await waitFor(() =>
    expect(
      fetchMock.callHistory.called(
        `glob:*/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
      ),
    ).toBe(true),
  );
});

test('shows an error when fetching datasource metadata fails', async () => {
  const datasourceKey = '3__table';
  const initialState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      form_data: {
        datasource: '1__table',
        viz_type: VizType.Table,
        metrics: [],
      },
    },
  };
  fetchMock.get(
    `glob:*/fetch_datasource_metadata?datasourceKey=${datasourceKey}`,
    500,
  );
  const store = createStore(initialState, reducerIndex);
  renderWithRouter({ initialState, store: store as Store });

  act(() => {
    store.dispatch(
      exploreActions.setControlValue('datasource', datasourceKey, []),
    );
  });

  await waitFor(() =>
    expect(
      (
        store.getState() as unknown as {
          messageToasts: { text: string }[];
        }
      ).messageToasts,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          text: 'Failed to load datasource metadata',
        }),
      ]),
    ),
  );
});

test('generates a new form_data param when none is available', async () => {
  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'fake table',
      thumbnail: '.png',
    }),
  );
  const history = createMemoryHistory({ initialEntries: [defaultPath] });
  const replaceSpy = jest.spyOn(history, 'replace');
  renderWithRouter({ history });
  await waitFor(() => {
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.stringMatching('form_data_key'),
      expect.anything(),
    );
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.stringMatching('datasource_id'),
      expect.anything(),
    );
  });
  replaceSpy.mockRestore();
});

// Mirrors production: hydrateExplore seeds `explore.standalone` from
// getUrlParam(URL_PARAMS.standalone), so it holds the coerced numeric mode ('true'
// arrives as 1) or null. Deriving it from the same search string here keeps the
// fixture honest instead of hardcoding a boolean the app never stores.
const standaloneState = (search: string) => ({
  search,
  initialState: {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      standalone: getUrlParam(URL_PARAMS.standalone, search),
    },
  },
});

test('renders chart in standalone mode', () => {
  const { queryByTestId } = renderWithRouter(standaloneState('?standalone=1'));
  expect(queryByTestId('standalone-app')).toBeInTheDocument();
});

test('preserves legacy standalone=true as chart-only mode', () => {
  // Backwards compatibility for links created before numeric modes existed.
  // `standalone` is declared a number param, so getUrlParam maps 'true' to 1;
  // the backend also still treats 'true' as standalone. Old bookmarks, embeds
  // and report URLs must keep rendering chart-only rather than the full editor.
  const { queryByTestId } = renderWithRouter(
    standaloneState('?standalone=true'),
  );
  expect(queryByTestId('standalone-app')).toBeInTheDocument();
});

test('renders chart-only for report captures (standalone=3)', () => {
  // ChartStandaloneMode.REPORT. Report and thumbnail captures must stay
  // chart-only; 3 is also what the backend's truthiness check accepts, so this
  // doubles as coverage for any value it allows that is not the mode 2 opt-in.
  const { queryByTestId } = renderWithRouter(standaloneState('?standalone=3'));
  expect(queryByTestId('standalone-app')).toBeInTheDocument();
});

test('renders full editor in standalone=2 mode (hide nav, show controls)', () => {
  const { queryByTestId } = renderWithRouter(standaloneState('?standalone=2'));
  expect(queryByTestId('standalone-app')).not.toBeInTheDocument();
  // Positive assertion on the mode-2 marker: without it this test would also
  // pass for mode 0, since both render the editor.
  expect(queryByTestId('explore-chart-panel-hide-nav')).toBeInTheDocument();
});

test('renders the normal editor when standalone is absent', () => {
  const { queryByTestId } = renderWithRouter({ search: '' });
  expect(queryByTestId('explore-chart-panel')).toBeInTheDocument();
  expect(queryByTestId('standalone-app')).not.toBeInTheDocument();
  expect(queryByTestId('explore-chart-panel-hide-nav')).not.toBeInTheDocument();
});

test('generates a form_data param with datasource_id when mounting with existing key', async () => {
  const history = createMemoryHistory({
    initialEntries: [`${defaultPath}${SEARCH}`],
  });
  const replaceSpy = jest.spyOn(history, 'replace');
  renderWithRouter({ search: SEARCH, history });
  await waitFor(() =>
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.stringMatching('datasource_id'),
      expect.anything(),
    ),
  );
  replaceSpy.mockRestore();
});

test('reuses the same form_data param when updating', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const history = createMemoryHistory({
    initialEntries: [`${defaultPath}${SEARCH}`],
  });
  const replaceSpy = jest.spyOn(history, 'replace');
  renderWithRouter({ search: SEARCH, history });
  await waitFor(() => expect(replaceSpy).toHaveBeenCalled());
  const previousCall = replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1];
  const previousCallCount = replaceSpy.mock.calls.length;
  await userEvent.click(screen.getByText('Update chart'));
  await waitFor(() =>
    expect(replaceSpy.mock.calls.length).toBeGreaterThan(previousCallCount),
  );
  expect(replaceSpy.mock.calls[replaceSpy.mock.calls.length - 1]).toEqual(
    previousCall,
  );
  replaceSpy.mockRestore();
  getChartControlPanelRegistry().remove('table');
});

test('pushes a history entry when the chart changed, so Back undoes it', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const initialState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      form_data: {
        datasource: '1__table',
        viz_type: VizType.Table,
        metrics: [],
      },
      controls: { ...reduxState.explore.controls, row_limit: { value: 100 } },
    },
  };
  const store = createStore(initialState, reducerIndex);
  const history = createMemoryHistory({
    initialEntries: [`${defaultPath}${SEARCH}`],
  });
  const pushSpy = jest.spyOn(history, 'push');
  renderWithRouter({
    search: SEARCH,
    history,
    initialState,
    store: store as Store,
  });
  // the entry Back should return to
  await waitFor(() =>
    expect(history.location.state).toEqual(
      expect.objectContaining({ row_limit: 100 }),
    ),
  );
  act(() => {
    store.dispatch(exploreActions.setControlValue('row_limit', 200));
  });
  await userEvent.click(screen.getByText('Update chart'));
  await waitFor(() =>
    expect(pushSpy).toHaveBeenCalledWith(
      expect.stringMatching('form_data_key'),
      // the chart id is stamped on, the controls don't produce one
      expect.objectContaining({ row_limit: 200, slice_id: 1 }),
    ),
  );
  pushSpy.mockRestore();
  getChartControlPanelRegistry().remove('table');
});

const renderWithMemoryRouter = ({
  initialState,
  store,
}: {
  initialState: object;
  store: Store;
}) => {
  // MemoryRouter builds the history react-router itself ships, the one Explore
  // sees at runtime - the top-level `history` package is a different major
  let routerHistory: RouteComponentProps['history'] | undefined;
  const result = render(
    <MemoryRouter initialEntries={[`${defaultPath}${SEARCH}`]}>
      <Route
        render={({ history }) => {
          routerHistory ??= history;
          return <ExploreViewContainer />;
        }}
      />
    </MemoryRouter>,
    { useRedux: true, useDnd: true, initialState, store },
  );
  return {
    ...result,
    routerHistory: routerHistory as RouteComponentProps['history'],
  };
};

test('restores the state of a popped entry without leaving the chart stale', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [
      { label: 'Options', expanded: true, controlSetRows: [['row_limit']] },
    ],
  });
  const initialState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      form_data: {
        datasource: '1__table',
        viz_type: VizType.Table,
        metrics: [],
      },
      controls: { ...reduxState.explore.controls, row_limit: { value: 100 } },
    },
  };
  const store = createStore(initialState, reducerIndex);
  const { routerHistory } = renderWithMemoryRouter({
    initialState,
    store: store as Store,
  });
  await waitFor(() =>
    expect(routerHistory.location.state).toEqual(
      expect.objectContaining({ row_limit: 100 }),
    ),
  );
  act(() => {
    store.dispatch(exploreActions.setControlValue('row_limit', 200));
  });
  expect(screen.getByTestId('control-panels-container')).toHaveAttribute(
    'data-stale',
    'true',
  );
  await userEvent.click(screen.getByText('Update chart'));
  await waitFor(() =>
    expect(routerHistory.location.state).toEqual(
      expect.objectContaining({ row_limit: 200 }),
    ),
  );

  act(() => {
    routerHistory.goBack();
  });
  await waitFor(() =>
    expect(screen.getByTestId('control-panels-container')).toHaveAttribute(
      'data-stale',
      'false',
    ),
  );
  getChartControlPanelRegistry().remove('table');
});

test('doesnt push an entry for the state a popped entry restored', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [
      { label: 'Options', expanded: true, controlSetRows: [['y_axis_format']] },
    ],
  });
  const initialState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      form_data: {
        datasource: '1__table',
        viz_type: VizType.Table,
        metrics: [],
      },
      controls: {
        ...reduxState.explore.controls,
        y_axis_format: { value: ',d', renderTrigger: true },
      },
    },
  };
  const store = createStore(initialState, reducerIndex);
  const { routerHistory } = renderWithMemoryRouter({
    initialState,
    store: store as Store,
  });
  await waitFor(() =>
    expect(routerHistory.location.state).toEqual(
      expect.objectContaining({ y_axis_format: ',d' }),
    ),
  );
  const pushSpy = jest.spyOn(routerHistory, 'push');
  // a render-trigger change gets its own entry
  act(() => {
    store.dispatch(exploreActions.setControlValue('y_axis_format', '.2f'));
  });
  await waitFor(() => expect(pushSpy).toHaveBeenCalledTimes(1));

  act(() => {
    routerHistory.goBack();
  });
  await waitFor(() =>
    expect(routerHistory.location.state).toEqual(
      expect.objectContaining({ y_axis_format: ',d' }),
    ),
  );
  expect(pushSpy).toHaveBeenCalledTimes(1);
  pushSpy.mockRestore();
  getChartControlPanelRegistry().remove('table');
});

test('doesnt call replace when pathname is not /explore', async () => {
  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'fake table',
      thumbnail: '.png',
    }),
  );
  const history = createMemoryHistory({ initialEntries: ['/dashboard'] });
  const replaceSpy = jest.spyOn(history, 'replace');
  renderWithRouter({ overridePathname: '/dashboard', history });
  expect(replaceSpy).not.toHaveBeenCalled();
  replaceSpy.mockRestore();
});

test('preserves unknown parameters', async () => {
  const unknownParam = 'test=123';
  const history = createMemoryHistory({
    initialEntries: [`${defaultPath}${SEARCH}&${unknownParam}`],
  });
  const replaceSpy = jest.spyOn(history, 'replace');
  renderWithRouter({ search: `${SEARCH}&${unknownParam}`, history });
  await waitFor(() =>
    expect(replaceSpy).toHaveBeenCalledWith(
      expect.stringMatching(unknownParam),
      expect.anything(),
    ),
  );
  replaceSpy.mockRestore();
});

test('retains query mode requirements when query_mode is enabled', async () => {
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        query_mode: { value: 'raw' },
        optional_key1: { value: 'value1' },
        all_columns: { value: ['all_columns'] },
        groupby: { value: ['groupby'] },
      },
      hiddenFormData: {
        all_columns: ['all_columns'],
        groupby: ['groupby'],
        optional_key1: 'value1',
      },
    },
  };

  renderWithRouter({ initialState: customState });

  await waitFor(() => {
    const formDataEndpointCalls = fetchMock.callHistory.calls(
      /api\/v1\/explore\/form_data/,
    );
    expect(formDataEndpointCalls.length).toBeGreaterThan(0);
  });
  const formDataEndpointCalls = fetchMock.callHistory.calls(
    /api\/v1\/explore\/form_data/,
  );
  const lastCall = formDataEndpointCalls[formDataEndpointCalls.length - 1];

  const body = JSON.parse(lastCall.options?.body as string);
  const formData = JSON.parse(body.form_data);

  const queryModeFields = Object.keys(
    customState.explore.hiddenFormData,
  ).filter(key => QUERY_MODE_REQUISITES.has(key));

  queryModeFields.forEach(key => {
    expect(formData[key]).toBeDefined();
  });
  expect(formData.optional_key1).toBeUndefined();
});

test('does omit hiddenFormData when query_mode is not enabled', async () => {
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        optional_key1: { value: 'value1' },
        all_columns: { value: ['all_columns'] },
        groupby: { value: ['groupby'] },
      },
      hiddenFormData: {
        all_columns: ['all_columns'],
        groupby: ['groupby'],
        optional_key1: 'value1',
      },
    },
  };

  renderWithRouter({ initialState: customState });

  await waitFor(() => {
    const formDataEndpointCalls = fetchMock.callHistory.calls(
      /api\/v1\/explore\/form_data/,
    );
    expect(formDataEndpointCalls.length).toBeGreaterThan(0);
  });
  const formDataEndpointCalls = fetchMock.callHistory.calls(
    /api\/v1\/explore\/form_data/,
  );
  const lastCall = formDataEndpointCalls[formDataEndpointCalls.length - 1];

  const body = JSON.parse(lastCall.options?.body as string);
  const formData = JSON.parse(body.form_data);

  Object.keys(customState.explore.hiddenFormData).forEach(key => {
    expect(formData[key]).toBeUndefined();
  });
});

// Component tests for the errorMessage behavior
test('does not show error indicator when no controls have validation errors', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        metric: { value: 'count', label: 'Metric' },
        groupby: { value: ['category'], label: 'Group by' },
      },
    },
  };

  renderWithRouter({ initialState: customState });

  await waitFor(() => {
    const errorIndicator = screen.queryByTestId('query-error-tooltip-trigger');
    expect(errorIndicator).not.toBeInTheDocument();
  });
});

test('shows error indicator when controls have validation errors', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        metric: {
          value: '',
          label: 'Metric',
          validationErrors: ['Metric is required'],
        },
      },
    },
  };

  renderWithRouter({ initialState: customState });

  const errorIndicator = await screen.findByTestId(
    'query-error-tooltip-trigger',
  );

  await userEvent.hover(errorIndicator);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();

  const errorMessage = await screen.findByText(/Metric is required/);
  expect(errorMessage).toBeInTheDocument();
});

test('shows error indicator for multiple controls with validation errors', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        metric: {
          value: '',
          label: 'Metric',
          validationErrors: ['Field is required'],
        },
        groupby: {
          value: [],
          label: 'Group by',
          validationErrors: ['Field is required'],
        },
      },
    },
  };

  renderWithRouter({ initialState: customState });

  const errorIndicator = await screen.findByTestId(
    'query-error-tooltip-trigger',
  );

  await userEvent.hover(errorIndicator);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();

  expect(await screen.findByText(/Field is required/)).toBeInTheDocument();
});

test('shows error indicator for control with multiple validation errors', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        metric: {
          value: '',
          label: 'Metric',
          validationErrors: ['Field is required', 'Invalid format'],
        },
      },
    },
  };

  renderWithRouter({ initialState: customState });

  const errorIndicator = await screen.findByTestId(
    'query-error-tooltip-trigger',
  );

  await userEvent.hover(errorIndicator);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();

  expect(await screen.findByText(/Field is required/)).toBeInTheDocument();
  expect(await screen.findByText(/Invalid format/)).toBeInTheDocument();
});

test('shows error indicator with function labels', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  // Ensure the explore state passed to the label function contains the expected property
  const customState = {
    ...reduxState,
    explore: {
      ...reduxState.explore,
      someState: 'test',
      controls: {
        ...reduxState.explore.controls,
        metric: {
          value: '',
          label: (exploreState: { someState: string }) =>
            `Dynamic Metric (${exploreState.someState})`,
          validationErrors: ['Metric is required'],
        },
      },
    },
  };

  renderWithRouter({ initialState: customState });

  const errorIndicator = await screen.findByTestId(
    'query-error-tooltip-trigger',
  );

  await userEvent.hover(errorIndicator);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();

  expect(await screen.findByText(/Metric is required/)).toBeInTheDocument();
});

const renderAfterInitialQuery = async (initialState: object) => {
  const triggerQuerySpy = jest.spyOn(chartActions, 'triggerQuery');
  const store = createStore(initialState, reducerIndex);
  renderWithRouter({ initialState, store: store as Store });
  // the mocked chart panel queries on mount; finish it like a real chart would
  await waitFor(() => expect(triggerQuerySpy).toHaveBeenCalled());
  act(() => {
    store.dispatch(chartActions.chartUpdateSucceeded([], 1));
  });
  triggerQuerySpy.mockClear();
  return { store, triggerQuerySpy };
};

test('Ctrl+Enter runs the query when controls are valid', async () => {
  const { triggerQuerySpy } = await renderAfterInitialQuery(reduxState);

  await userEvent.keyboard('{Control>}{Enter}{/Control}');

  expect(triggerQuerySpy).toHaveBeenCalledWith(true, 1);
});

test('Cmd+Enter runs the query when controls are valid', async () => {
  const { triggerQuerySpy } = await renderAfterInitialQuery(reduxState);

  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  expect(triggerQuerySpy).toHaveBeenCalledWith(true, 1);
});

test('Ctrl/Cmd+Enter does not run the query when controls have validation errors', async () => {
  const { triggerQuerySpy } = await renderAfterInitialQuery({
    ...reduxState,
    explore: {
      ...reduxState.explore,
      controls: {
        ...reduxState.explore.controls,
        metric: {
          value: '',
          label: 'Metric',
          validationErrors: ['Metric is required'],
        },
      },
    },
  });

  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  expect(triggerQuerySpy).not.toHaveBeenCalled();
});

test('Ctrl/Cmd+Enter does not run the query while the chart is loading', async () => {
  const { store, triggerQuerySpy } = await renderAfterInitialQuery(reduxState);
  act(() => {
    store.dispatch(
      chartActions.chartUpdateStarted(
        new AbortController(),
        reduxState.charts[1].latestQueryFormData,
        1,
      ),
    );
  });

  await userEvent.keyboard('{Control>}{Enter}{/Control}');
  await userEvent.keyboard('{Meta>}{Enter}{/Meta}');

  expect(triggerQuerySpy).not.toHaveBeenCalled();
});

function setupTableChartControlPanel() {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
}

test('automatic axis title margin adjustment sets X axis margin to 30 when title is added', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          x_axis_title: { value: '' },
          x_axis_title_margin: { value: 0 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being added by dispatching action
    store.dispatch(
      exploreActions.setControlValue('x_axis_title', 'X Axis Label'),
    );

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'x_axis_title_margin',
        30,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment sets Y axis margin to 30 when title is added', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          y_axis_title: { value: '' },
          y_axis_title_margin: { value: 0 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being added by dispatching action
    store.dispatch(
      exploreActions.setControlValue('y_axis_title', 'Y Axis Label'),
    );

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'y_axis_title_margin',
        30,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment resets X axis margin to 0 when title is removed', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          x_axis_title: { value: 'X Axis Label' },
          x_axis_title_margin: { value: 30 }, // or any non-zero value
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being removed by dispatching action
    store.dispatch(exploreActions.setControlValue('x_axis_title', ''));

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'x_axis_title_margin',
        0,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment resets Y axis margin to 0 when title is removed', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          y_axis_title: { value: 'Y Axis Label' },
          y_axis_title_margin: { value: 30 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being removed by dispatching action
    store.dispatch(exploreActions.setControlValue('y_axis_title', ''));

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'y_axis_title_margin',
        0,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment does not change X axis margin when title is added but margin is already non-zero', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          x_axis_title: { value: '' },
          x_axis_title_margin: { value: 50 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being added by dispatching action
    store.dispatch(
      exploreActions.setControlValue('x_axis_title', 'X Axis Label'),
    );

    // Wait a bit to ensure useEffect has run
    await waitFor(() => {
      expect(
        screen.queryByTestId('query-error-tooltip-trigger'),
      ).not.toBeInTheDocument();
    });

    // Should NOT call setControlValue since margin is already non-zero
    expect(setControlValueSpy).not.toHaveBeenCalledWith(
      'x_axis_title_margin',
      expect.any(Number),
    );
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment changes X axis margin when title is added and margin is less than 30', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          x_axis_title: { value: '' },
          x_axis_title_margin: { value: 20 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being added by dispatching action
    store.dispatch(
      exploreActions.setControlValue('x_axis_title', 'X Axis Label'),
    );

    // Should call setControlValue since margin is less than 30, once the
    // debounced margin effect settles
    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'x_axis_title_margin',
        30,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment does not change Y axis margin when title is added but margin is already non-zero', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          y_axis_title: { value: '' },
          y_axis_title_margin: { value: 50 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being added by dispatching action
    store.dispatch(
      exploreActions.setControlValue('y_axis_title', 'Y Axis Label'),
    );

    // Wait a bit to ensure useEffect has run
    await waitFor(() => {
      expect(
        screen.queryByTestId('query-error-tooltip-trigger'),
      ).not.toBeInTheDocument();
    });

    // Should NOT call setControlValue since margin is already non-zero
    expect(setControlValueSpy).not.toHaveBeenCalledWith(
      'y_axis_title_margin',
      expect.any(Number),
    );
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment changes Y axis margin when title is added and margin is less than 30', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          y_axis_title: { value: '' },
          y_axis_title_margin: { value: 20 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate title being added by dispatching action
    store.dispatch(
      exploreActions.setControlValue('y_axis_title', 'Y Axis Label'),
    );

    // Should call setControlValue since margin is less than 30, once the
    // debounced margin effect settles
    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'y_axis_title_margin',
        30,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

test('automatic axis title margin adjustment handles both X and Y axis titles being set simultaneously', async () => {
  setupTableChartControlPanel();
  try {
    const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

    const initialState = {
      ...reduxState,
      explore: {
        ...reduxState.explore,
        form_data: {
          datasource: '1__table',
          viz_type: VizType.Table,
          metrics: [],
        },
        controls: {
          ...reduxState.explore.controls,
          x_axis_title: { value: '' },
          x_axis_title_margin: { value: 0 },
          y_axis_title: { value: '' },
          y_axis_title_margin: { value: 0 },
        },
      },
    };

    const store = createStore(initialState, reducerIndex);
    renderWithRouter({ initialState, store: store as Store });

    // Clear any calls from initial render
    setControlValueSpy.mockClear();

    // Simulate both titles being added simultaneously
    store.dispatch(
      exploreActions.setControlValue('x_axis_title', 'X Axis Label'),
    );
    store.dispatch(
      exploreActions.setControlValue('y_axis_title', 'Y Axis Label'),
    );

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'x_axis_title_margin',
        30,
        undefined,
        { programmatic: true },
      );
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'y_axis_title_margin',
        30,
        undefined,
        { programmatic: true },
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});

const getChart = (store: Store) =>
  (
    store.getState() as {
      charts: Record<number, { triggerQuery?: boolean }>;
    }
  ).charts[1];

// Renders the explore view, finishes the chart load that mounting starts and
// clears the query it queues, so a test can tell whether its own interaction
// queues one again.
const renderWithClearedQuery = async () => {
  const store = createStore(reduxState, reducerIndex);
  renderWithRouter({ initialState: reduxState, store: store as Store });
  await screen.findByTestId('control-panels-container');
  act(() => {
    store.dispatch(chartActions.chartUpdateSucceeded([], 1));
    store.dispatch(chartActions.triggerQuery(false, 1));
  });
  return store as Store;
};

test.each([
  ['Enter without a modifier', '{Enter}'],
  ['Ctrl with another key', '{Control>}a{/Control}'],
])('%s does not queue the chart query', async (_, keys) => {
  setupTableChartControlPanel();
  try {
    const store = await renderWithClearedQuery();

    await userEvent.keyboard(keys);

    expect(getChart(store).triggerQuery).toBe(false);
  } finally {
    getChartControlPanelRegistry().remove('table');
  }
});

const stateWithControls = (controls: object) => ({
  ...reduxState,
  explore: {
    ...reduxState.explore,
    controls: { ...reduxState.explore.controls, ...controls },
  },
});

test('keeps the Run button enabled when no control has validation errors', async () => {
  setupTableChartControlPanel();
  try {
    renderWithRouter({
      initialState: stateWithControls({
        metric: { value: 'count', label: 'Metric' },
      }),
    });

    const panel = await screen.findByTestId('control-panels-container');
    expect(panel).toHaveAttribute('data-has-button-error', 'false');
    expect(screen.getByRole('button', { name: 'Update chart' })).toBeEnabled();
  } finally {
    getChartControlPanelRegistry().remove('table');
  }
});

test('disables the Run button and reports the error when a control fails validation', async () => {
  setupTableChartControlPanel();
  try {
    renderWithRouter({
      initialState: stateWithControls({
        metric: {
          value: '',
          label: 'Metric',
          validationErrors: ['Metric is required'],
        },
      }),
    });

    const panel = await screen.findByTestId('control-panels-container');
    expect(panel).toHaveAttribute('data-has-button-error', 'true');
    expect(panel).toHaveAttribute('data-has-data-tab-error', 'true');
    expect(screen.getByRole('button', { name: 'Update chart' })).toBeDisabled();
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Control labeled Metric: Metric is required',
    );
  } finally {
    getChartControlPanelRegistry().remove('table');
  }
});

test('disables the Run button for a matrixify control error without flagging the Data tab', async () => {
  setupTableChartControlPanel();
  try {
    renderWithRouter({
      initialState: stateWithControls({
        matrixify_rows: {
          value: '',
          label: 'Rows',
          tabOverride: 'matrixify',
          validationErrors: ['Rows are required'],
        },
      }),
    });

    const panel = await screen.findByTestId('control-panels-container');
    expect(panel).toHaveAttribute('data-has-button-error', 'true');
    expect(panel).toHaveAttribute('data-has-data-tab-error', 'false');
    expect(screen.getByRole('button', { name: 'Update chart' })).toBeDisabled();
  } finally {
    getChartControlPanelRegistry().remove('table');
  }
});

const tooltipState = (vizType: string, template = '') => ({
  ...reduxState,
  charts: {
    1: {
      ...reduxState.charts[1],
      latestQueryFormData: {
        ...reduxState.charts[1].latestQueryFormData,
        viz_type: vizType,
      },
    },
  },
  explore: {
    ...reduxState.explore,
    form_data: { datasource: '1__table', viz_type: vizType, metrics: [] },
    controls: {
      ...reduxState.explore.controls,
      viz_type: { value: vizType },
      tooltip_contents: { value: [] },
      tooltip_template: { value: template },
    },
  },
});

// Renders the container and returns a function that selects tooltip contents
// the way the control would and reports the template the container wrote back.
const renderTooltipChart = (vizType: string, template = '') => {
  getChartControlPanelRegistry().registerValue(vizType, {
    controlPanelSections: [],
  });
  const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');
  const initialState = tooltipState(vizType, template);
  const store = createStore(initialState, reducerIndex);
  renderWithRouter({ initialState, store: store as Store });
  setControlValueSpy.mockClear();
  return {
    selectTooltipContents: (contents: unknown[]) => {
      act(() => {
        store.dispatch(
          exploreActions.setControlValue('tooltip_contents', contents),
        );
      });
    },
    templateWrites: () =>
      setControlValueSpy.mock.calls
        .filter(([controlName]) => controlName === 'tooltip_template')
        .map(([, value]) => value),
    storedTemplate: () =>
      ((store as Store).getState() as ExplorePageState).explore.controls
        .tooltip_template?.value,
    cleanup: () => getChartControlPanelRegistry().remove(vizType),
  };
};

test('appends a {{ field }} variable to the tooltip template for a selected column', () => {
  const chart = renderTooltipChart('deck_scatter');
  try {
    chart.selectTooltipContents([{ item_type: 'column', column_name: 'name' }]);

    expect(chart.templateWrites()).toEqual(['{{ name }}']);
    expect(chart.storedTemplate()).toBe('{{ name }}');
  } finally {
    chart.cleanup();
  }
});

test('appends after the existing tooltip template text', () => {
  const chart = renderTooltipChart('deck_scatter', 'Details:');
  try {
    chart.selectTooltipContents([{ item_type: 'column', column_name: 'name' }]);

    expect(chart.templateWrites()).toEqual(['Details: {{ name }}']);
    expect(chart.storedTemplate()).toBe('Details: {{ name }}');
  } finally {
    chart.cleanup();
  }
});

test('appends a limited variable for a column on an aggregated chart', () => {
  const chart = renderTooltipChart('heatmap');
  try {
    chart.selectTooltipContents([{ item_type: 'column', column_name: 'name' }]);

    expect(chart.templateWrites()).toEqual(['{{ limit name 10 }}']);
    expect(chart.storedTemplate()).toBe('{{ limit name 10 }}');
  } finally {
    chart.cleanup();
  }
});

test('appends a plain variable for a metric even on an aggregated chart', () => {
  const chart = renderTooltipChart('heatmap');
  try {
    chart.selectTooltipContents([
      { item_type: 'metric', metric_name: 'count' },
    ]);

    expect(chart.templateWrites()).toEqual(['{{ count }}']);
    expect(chart.storedTemplate()).toBe('{{ count }}');
  } finally {
    chart.cleanup();
  }
});

test('leaves the tooltip template alone when it already references the field', () => {
  const chart = renderTooltipChart('deck_scatter', 'Name: {{ name }}');
  try {
    chart.selectTooltipContents([{ item_type: 'column', column_name: 'name' }]);

    expect(chart.templateWrites()).toEqual([]);
    expect(chart.storedTemplate()).toBe('Name: {{ name }}');
  } finally {
    chart.cleanup();
  }
});

const datasourceState = {
  ...reduxState,
  explore: {
    ...reduxState.explore,
    form_data: { datasource: '1__table', viz_type: VizType.Table, metrics: [] },
    controls: { ...reduxState.explore.controls, row_limit: { value: 100 } },
  },
};

test('does not request datasource metadata when an unrelated control changes', () => {
  setupTableChartControlPanel();
  try {
    const fetchMetadataSpy = jest.spyOn(
      datasourceActions,
      'fetchDatasourceMetadata',
    );
    const store = createStore(datasourceState, reducerIndex);
    renderWithRouter({ initialState: datasourceState, store: store as Store });
    fetchMetadataSpy.mockClear();

    act(() => {
      store.dispatch(exploreActions.setControlValue('row_limit', 200));
    });

    expect(fetchMetadataSpy).not.toHaveBeenCalled();
  } finally {
    getChartControlPanelRegistry().remove('table');
  }
});

type Axis = 'x' | 'y';

// Explore state for a Table chart whose `<axis>_axis_title` and
// `<axis>_axis_title_margin` controls start at the given values.
const axisTitleState = (axis: Axis, title: string, margin: number) => ({
  ...reduxState,
  explore: {
    ...reduxState.explore,
    form_data: {
      datasource: '1__table',
      viz_type: VizType.Table,
      metrics: [],
    },
    controls: {
      ...reduxState.explore.controls,
      [`${axis}_axis_title`]: { value: title },
      [`${axis}_axis_title_margin`]: { value: margin },
    },
  },
});

// The arguments of a programmatic margin write made by the container itself,
// as opposed to the dispatches the tests make.
const programmaticMarginWrite = (axis: Axis) => [
  `${axis}_axis_title_margin`,
  expect.anything(),
  undefined,
  { programmatic: true },
];

const controlValue = (store: Store, name: string) =>
  (
    store.getState() as unknown as {
      explore: { controls: Record<string, { value: unknown }> };
    }
  ).explore.controls[name].value;

const marginIn = (store: Store, axis: Axis) =>
  controlValue(store, `${axis}_axis_title_margin`);

test.each<Axis>(['x', 'y'])(
  'automatic %s axis title margin adjustment ignores a transient empty value from a quick clear-and-retype',
  async axis => {
    setupTableChartControlPanel();
    try {
      const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

      // a custom margin above the default 30
      const initialState = axisTitleState(axis, 'Axis Label', 75);
      const store = createStore(initialState, reducerIndex);
      renderWithRouter({ initialState, store: store as Store });

      // Clear any calls from initial render
      setControlValueSpy.mockClear();

      // A transient axis title -- e.g. one cleared and then replaced, or one
      // flushed on blur mid-edit -- can briefly pass an empty value through
      // here before the retyped value settles. The margin effect must react
      // to the settled value only, not this transient one, or it would zero
      // out a custom margin and then bump it back to 30, losing the original
      // 75.
      // Commit the clear on its own so the margin effect actually sees the
      // empty value, then retype inside the debounce window.
      act(() => {
        store.dispatch(
          exploreActions.setControlValue(`${axis}_axis_title`, ''),
        );
      });
      act(() => {
        store.dispatch(
          exploreActions.setControlValue(
            `${axis}_axis_title`,
            'Axis Label Redone',
          ),
        );
      });

      // Give the debounced margin effect more than its window to settle.
      await new Promise(resolve => setTimeout(resolve, 300));

      expect(setControlValueSpy).not.toHaveBeenCalledWith(
        ...programmaticMarginWrite(axis),
      );
      expect(marginIn(store, axis)).toBe(75);
    } finally {
      getChartControlPanelRegistry().remove('table');
      jest.restoreAllMocks();
    }
  },
);

test.each<Axis>(['x', 'y'])(
  'automatic %s axis title margin adjustment yields to a margin picked inside the debounce window',
  async axis => {
    setupTableChartControlPanel();
    try {
      const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

      const initialState = axisTitleState(axis, '', 0);
      const store = createStore(initialState, reducerIndex);
      renderWithRouter({ initialState, store: store as Store });
      setControlValueSpy.mockClear();

      act(() => {
        store.dispatch(
          exploreActions.setControlValue(`${axis}_axis_title`, 'Axis Label'),
        );
      });
      // the user picks a margin before the adjustment timer fires
      act(() => {
        store.dispatch(
          exploreActions.setControlValue(`${axis}_axis_title_margin`, 15),
        );
      });

      await new Promise(resolve => setTimeout(resolve, 300));

      expect(setControlValueSpy).not.toHaveBeenCalledWith(
        ...programmaticMarginWrite(axis),
      );
      expect(marginIn(store, axis)).toBe(15);
    } finally {
      getChartControlPanelRegistry().remove('table');
      jest.restoreAllMocks();
    }
  },
);

test.each<Axis>(['x', 'y'])(
  'automatic %s axis title margin adjustment is dropped when the viz type changes inside the debounce window',
  async axis => {
    setupTableChartControlPanel();
    // A second viz with the same axis title and margin controls, so the
    // title carries over and the margin stays 0 across the switch. Only the
    // viz type snapshot then tells the pending adjustment it no longer
    // applies; a viz whose margin differs is already caught by the margin
    // snapshot.
    getChartControlPanelRegistry().registerValue('fake_viz', {
      controlPanelSections: [
        {
          label: 'Chart Options',
          expanded: true,
          controlSetRows: [
            [
              {
                name: `${axis}_axis_title`,
                config: { type: 'TextControl', label: 'Title', default: '' },
              },
            ],
            [
              {
                name: `${axis}_axis_title_margin`,
                config: {
                  type: 'TextControl',
                  label: 'Margin',
                  isInt: true,
                  default: 0,
                  renderTrigger: true,
                },
              },
            ],
          ],
        },
      ],
    });
    try {
      const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

      const initialState = axisTitleState(axis, '', 0);
      const store = createStore(initialState, reducerIndex);
      renderWithRouter({ initialState, store: store as Store });
      setControlValueSpy.mockClear();

      act(() => {
        store.dispatch(
          exploreActions.setControlValue(`${axis}_axis_title`, 'Axis Label'),
        );
      });
      // switch viz before the adjustment timer fires
      act(() => {
        store.dispatch(exploreActions.setControlValue('viz_type', 'fake_viz'));
      });
      expect(controlValue(store, `${axis}_axis_title`)).toBe('Axis Label');
      expect(marginIn(store, axis)).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 300));

      // the adjustment was scheduled against the Table chart, not this one
      expect(setControlValueSpy).not.toHaveBeenCalledWith(
        ...programmaticMarginWrite(axis),
      );
      expect(marginIn(store, axis)).toBe(0);
    } finally {
      getChartControlPanelRegistry().remove('table');
      getChartControlPanelRegistry().remove('fake_viz');
      jest.restoreAllMocks();
    }
  },
);

test.each<Axis>(['x', 'y'])(
  'automatic %s axis title margin adjustment restarts its window on every title edit',
  async axis => {
    setupTableChartControlPanel();
    jest.useFakeTimers();
    try {
      const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

      const initialState = axisTitleState(axis, 'Axis Label', 75);
      const store = createStore(initialState, reducerIndex);
      renderWithRouter({ initialState, store: store as Store });
      setControlValueSpy.mockClear();

      const setTitle = (title: string) =>
        act(() => {
          store.dispatch(
            exploreActions.setControlValue(`${axis}_axis_title`, title),
          );
        });

      // Each edit must restart the window. If it did not, the timer from
      // the first edit would fire at 250ms, see the transient empty title
      // from the clear at 200ms, and zero the custom margin.
      setTitle('Axis Label Edited');
      act(() => jest.advanceTimersByTime(200));
      setTitle('');
      act(() => jest.advanceTimersByTime(100));
      setTitle('Axis Label Redone');
      // past the first timer's deadline and past the restarted window
      act(() => jest.advanceTimersByTime(600));

      expect(setControlValueSpy).not.toHaveBeenCalledWith(
        ...programmaticMarginWrite(axis),
      );
      expect(marginIn(store, axis)).toBe(75);
    } finally {
      jest.useRealTimers();
      getChartControlPanelRegistry().remove('table');
      jest.restoreAllMocks();
    }
  },
);

test.each<Axis>(['x', 'y'])(
  'automatic %s axis title margin adjustment is cancelled when the container unmounts inside the debounce window',
  async axis => {
    setupTableChartControlPanel();
    jest.useFakeTimers();
    try {
      const setControlValueSpy = jest.spyOn(exploreActions, 'setControlValue');

      const initialState = axisTitleState(axis, '', 0);
      const store = createStore(initialState, reducerIndex);
      const { unmount } = renderWithRouter({
        initialState,
        store: store as Store,
      });
      setControlValueSpy.mockClear();

      act(() => {
        store.dispatch(
          exploreActions.setControlValue(`${axis}_axis_title`, 'Axis Label'),
        );
      });
      // navigate away before the adjustment timer fires
      unmount();
      act(() => jest.advanceTimersByTime(600));

      expect(setControlValueSpy).not.toHaveBeenCalledWith(
        ...programmaticMarginWrite(axis),
      );
      expect(marginIn(store, axis)).toBe(0);
    } finally {
      jest.useRealTimers();
      getChartControlPanelRegistry().remove('table');
      jest.restoreAllMocks();
    }
  },
);
test('document.title falls back to the app name on unmount, not the title present at mount', async () => {
  // A direct page load of an explore URL arrives with the chart name already
  // in <title>, so restoring the title seen at mount leaves the stale name in
  // the tab after navigating away.
  const titleBeforeTest = document.title;
  document.title = 'Test Chart';
  try {
    const { unmount } = renderWithRouter({
      initialState: {
        ...reduxState,
        explore: { ...reduxState.explore, sliceName: 'Test Chart' },
      },
    });

    await waitFor(() => expect(document.title).toBe('Test Chart'));

    unmount();

    expect(document.title).toBe('Superset');
  } finally {
    document.title = titleBeforeTest;
  }
});

test('Explore offers a panel location between its header and its chart', async () => {
  // What is left of the host once the banner it used to mount by name is a
  // contribution: the location, laid out unconditionally. Unconditionally
  // because an enumerated feature flag here is the same coupling as the
  // import was -- the host would again know which extension it is waiting
  // for -- and the slot draws nothing when nobody contributes to it.
  offeredViewIds.length = 0;
  renderWithRouter();

  await waitFor(() =>
    expect(offeredViewIds).toContain(ViewLocations.explore.panel),
  );
});

/**
 * The other half of the same hand-over.
 *
 * The location is where a write holder puts its banner; this command is how
 * it asks for the version it is holding to be drawn. Explore keeps the
 * composition -- the live chart the held fields are laid over is in its own
 * store, and the holder has never seen it -- and publishes one verb over it.
 *
 * Asserted on the announcement, which is the whole of what the command does:
 * compose the held fields into a chart, vacate the column for it, and hand it
 * to whoever is drawing it. The drawing itself is the holder's.
 */
describe('the command that draws a held version of the chart', () => {
  const heard: HeldVersionState[] = [];
  let stopListening: () => void;

  /** Ask for a version, and hand back what the command answered. */
  const show = async (...args: unknown[]): Promise<unknown> => {
    let answer: unknown;
    await act(async () => {
      answer = await commands.executeCommand(
        SHOW_HELD_VERSION_COMMAND,
        ...args,
      );
    });
    return answer;
  };

  const lastAnnounced = () => heard[heard.length - 1];

  /** Explore on screen, with its command registered and ready to be asked. */
  const onExplore = async () => {
    renderWithRouter();
    await waitFor(() =>
      expect(commands.getCommand(SHOW_HELD_VERSION_COMMAND)).toBeDefined(),
    );
  };

  beforeEach(() => {
    heard.length = 0;
    stopListening = onHeldVersion(state => {
      heard.push(state);
    });
  });

  afterEach(() => stopListening());

  test('lays the held fields over the live chart and puts the result in the chart column', async () => {
    await onExplore();
    const onScreen = await show({
      params: JSON.stringify({
        datasource: '1__table',
        viz_type: VizType.Line,
      }),
    });

    expect(onScreen).toBe(true);
    expect(lastAnnounced().formData?.viz_type).toBe(VizType.Line);
    // Drawn as an unsaved chart, so the request never lands in the live
    // chart's cache slot and the two cannot overwrite each other's result.
    expect(lastAnnounced().formData?.slice_id).toBe(0);
  });

  test('called with nothing, it puts the live chart back', async () => {
    await onExplore();
    await show({ params: JSON.stringify({ viz_type: VizType.Line }) });

    const onScreen = await show(null);

    expect(onScreen).toBe(true);
    expect(lastAnnounced().formData).toBeNull();
    // Still previewable: the live chart is on screen *and labelled as the
    // live chart*, which is the state that used to be silent -- and a silent
    // default is one somebody can act on without ever having looked.
    expect(lastAnnounced().previewable).toBe(true);
  });

  test('falls back to the live chart for the fields a held body does not carry', async () => {
    await onExplore();
    // A REST `PUT` that moves only the viz type sends no params at all, and
    // that is a change to the drawing. Composing it against the chart as it
    // is now is also what applying it would do, which is the whole reason
    // the composition belongs to the host and not to the holder.
    const onScreen = await show({ viz_type: VizType.Line });

    expect(onScreen).toBe(true);
    expect(lastAnnounced().formData?.viz_type).toBe(VizType.Line);
    expect(lastAnnounced().formData?.datasource).toBe('1__table');
  });

  test('carries the holder’s note about a dataset that is itself held', async () => {
    await onExplore();
    // Which decision comes first. The preview queries the live dataset, so a
    // chart written against columns that are themselves waiting will fail or
    // mislead (QA-09) -- and only the holder knows, so it is passed in.
    await show(
      { params: JSON.stringify({ viz_type: VizType.Line }) },
      { title: 'birth_names', author: 'Alex Rivera' },
    );

    expect(lastAnnounced().heldDataset).toEqual({
      title: 'birth_names',
      author: 'Alex Rivera',
    });
  });
});

test('Explore offers the reload a write holder needs once its write is applied', async () => {
  // A plain reload is not enough and only Explore knows why: it caches its
  // form data under a `form_data_key` in the URL, and after a held save that
  // key describes the chart as it was before the decision. What the command
  // then does is `reloadFromTheServer`, which has its own tests; this is
  // that the verb is published at all, because nothing outside the host can
  // know to drop the key.
  renderWithRouter();

  await waitFor(() =>
    expect(commands.getCommand(RELOAD_COMMAND)).toBeDefined(),
  );
});

test('Explore offers the reload a write holder needs once its write is applied', async () => {
  // A plain reload is not enough and only Explore knows why: it caches its
  // form data under a `form_data_key` in the URL, and after a held save that
  // key describes the chart as it was before the decision. What the command
  // then does is `reloadFromTheServer`, which has its own tests; this is
  // that the verb is published at all, because nothing outside the host can
  // know to drop the key.
  renderWithRouter();

  await waitFor(() =>
    expect(commands.getCommand(RELOAD_COMMAND)).toBeDefined(),
  );
});

test('Explore lays out the column a contributed panel docks in', async () => {
  // Found by its id rather than by a role or a test id, because that id is
  // what a panel portalling in looks itself up by -- the lookup fails
  // silently, and what the panel falls back to is a fixed overlay lying over
  // the chart the reader is deciding on.
  renderWithRouter();

  await waitFor(() =>
    expect(document.getElementById(DOCKED_PANEL_SLOT)).not.toBeNull(),
  );
});

test('the chart column is vacated for the held version, and reclaimed after', async () => {
  // Whoever is holding the write draws its own chart and portals into this,
  // so the slot has to be there while a held version is up -- and gone again
  // once the live chart is back, or Explore would be left with an empty
  // column where its own chart belongs.
  renderWithRouter();
  await waitFor(() =>
    expect(commands.getCommand(SHOW_HELD_VERSION_COMMAND)).toBeDefined(),
  );
  expect(document.getElementById(HELD_VERSION_SLOT)).toBeNull();

  await act(async () => {
    await commands.executeCommand(SHOW_HELD_VERSION_COMMAND, {
      params: JSON.stringify({
        datasource: '1__table',
        viz_type: VizType.Line,
      }),
    });
  });
  await waitFor(() =>
    expect(document.getElementById(HELD_VERSION_SLOT)).not.toBeNull(),
  );

  await act(async () => {
    await commands.executeCommand(SHOW_HELD_VERSION_COMMAND, null);
  });
  await waitFor(() =>
    expect(document.getElementById(HELD_VERSION_SLOT)).toBeNull(),
  );
});

test('the held-version command is withdrawn when Explore leaves', async () => {
  // Withdrawn rather than left registered: the live form data it composes
  // against is this page's, so a command outliving the page would draw a held
  // version over whatever came next.
  const { unmount } = renderWithRouter();
  await waitFor(() =>
    expect(commands.getCommand(SHOW_HELD_VERSION_COMMAND)).toBeDefined(),
  );

  unmount();

  expect(commands.getCommand(SHOW_HELD_VERSION_COMMAND)).toBeUndefined();
});
