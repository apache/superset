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
import {
  getChartControlPanelRegistry,
  getChartMetadataRegistry,
  ChartMetadata,
  VizType,
} from '@superset-ui/core';
import { QUERY_MODE_REQUISITES } from 'src/explore/constants';
import { MemoryRouter, Route } from 'react-router-dom';
import {
  render,
  screen,
  userEvent,
  waitFor,
  createStore,
} from 'spec/helpers/testing-library';
import { Store } from '@reduxjs/toolkit';
import reducerIndex from 'spec/helpers/reducerIndex';
import * as exploreActions from 'src/explore/actions/exploreActions';
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
      owners: ['John Doe'],
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

jest.mock('lodash/debounce', () => ({
  __esModule: true,
  default: (fuc: Function) => fuc,
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
const renderWithRouter = ({
  search = '',
  overridePathname,
  initialState = reduxState,
  store,
}: {
  search?: string;
  overridePathname?: string;
  initialState?: object;
  store?: Store;
} = {}) => {
  const path = overridePathname ?? defaultPath;
  Object.defineProperty(window, 'location', {
    get() {
      return { pathname: path, search };
    },
  });
  return render(
    <MemoryRouter initialEntries={[`${path}${search}`]}>
      <Route path={path}>
        <ExploreViewContainer />
      </Route>
    </MemoryRouter>,
    { useRedux: true, useDnd: true, initialState, store },
  );
};

test('generates a new form_data param when none is available', async () => {
  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'fake table',
      thumbnail: '.png',
      useLegacyApi: false,
    }),
  );
  const replaceState = jest.spyOn(window.history, 'replaceState');
  await waitFor(() => renderWithRouter());
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching('form_data_key'),
  );
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching('datasource_id'),
  );
  replaceState.mockRestore();
});

test('renders chart in standalone mode', () => {
  const { queryByTestId } = renderWithRouter({
    initialState: {
      ...reduxState,
      explore: { ...reduxState.explore, standalone: true },
    },
  });
  expect(queryByTestId('standalone-app')).toBeInTheDocument();
});

test('generates a different form_data param when one is provided and is mounting', async () => {
  const replaceState = jest.spyOn(window.history, 'replaceState');
  await waitFor(() => renderWithRouter({ search: SEARCH }));
  expect(replaceState).not.toHaveBeenLastCalledWith(
    0,
    expect.anything(),
    undefined,
    expect.stringMatching(KEY),
  );
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching('datasource_id'),
  );
  replaceState.mockRestore();
});

test('reuses the same form_data param when updating', async () => {
  getChartControlPanelRegistry().registerValue('table', {
    controlPanelSections: [],
  });
  const replaceState = jest.spyOn(window.history, 'replaceState');
  const pushState = jest.spyOn(window.history, 'pushState');
  await waitFor(() => renderWithRouter({ search: SEARCH }));
  expect(replaceState.mock.calls.length).toBe(1);
  userEvent.click(screen.getByText('Update chart'));
  await waitFor(() => expect(pushState.mock.calls.length).toBe(1));
  expect(replaceState.mock.calls[0]).toEqual(pushState.mock.calls[0]);
  replaceState.mockRestore();
  pushState.mockRestore();
  getChartControlPanelRegistry().remove('table');
});

test('doesnt call replaceState when pathname is not /explore', async () => {
  getChartMetadataRegistry().registerValue(
    'table',
    new ChartMetadata({
      name: 'fake table',
      thumbnail: '.png',
      useLegacyApi: false,
    }),
  );
  const replaceState = jest.spyOn(window.history, 'replaceState');
  await waitFor(() => renderWithRouter({ overridePathname: '/dashboard' }));
  expect(replaceState).not.toHaveBeenCalled();
  replaceState.mockRestore();
});

test('preserves unknown parameters', async () => {
  const replaceState = jest.spyOn(window.history, 'replaceState');
  const unknownParam = 'test=123';
  await waitFor(() =>
    renderWithRouter({ search: `${SEARCH}&${unknownParam}` }),
  );
  expect(replaceState).toHaveBeenCalledWith(
    expect.anything(),
    undefined,
    expect.stringMatching(unknownParam),
  );
  replaceState.mockRestore();
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

  await waitFor(() => renderWithRouter({ initialState: customState }));

  const formDataEndpointCalls = fetchMock.calls(/api\/v1\/explore\/form_data/);
  expect(formDataEndpointCalls.length).toBeGreaterThan(0);
  const lastCall = formDataEndpointCalls[formDataEndpointCalls.length - 1];

  const body = JSON.parse(lastCall[1]?.body as string);
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

  await waitFor(() => renderWithRouter({ initialState: customState }));

  const formDataEndpointCalls = fetchMock.calls(/api\/v1\/explore\/form_data/);
  expect(formDataEndpointCalls.length).toBeGreaterThan(0);
  const lastCall = formDataEndpointCalls[formDataEndpointCalls.length - 1];

  const body = JSON.parse(lastCall[1]?.body as string);
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

  userEvent.hover(errorIndicator);

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

  userEvent.hover(errorIndicator);

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

  userEvent.hover(errorIndicator);

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

  userEvent.hover(errorIndicator);

  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toBeInTheDocument();

  expect(await screen.findByText(/Metric is required/)).toBeInTheDocument();
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
    store.dispatch(exploreActions.setControlValue('x_axis_title', 'X Axis Label'));

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'x_axis_title_margin',
        30,
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
    store.dispatch(exploreActions.setControlValue('y_axis_title', 'Y Axis Label'));

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'y_axis_title_margin',
        30,
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
    store.dispatch(exploreActions.setControlValue('x_axis_title', 'X Axis Label'));

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
    store.dispatch(exploreActions.setControlValue('y_axis_title', 'Y Axis Label'));

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
    store.dispatch(exploreActions.setControlValue('x_axis_title', 'X Axis Label'));
    store.dispatch(exploreActions.setControlValue('y_axis_title', 'Y Axis Label'));

    await waitFor(() => {
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'x_axis_title_margin',
        30,
      );
      expect(setControlValueSpy).toHaveBeenCalledWith(
        'y_axis_title_margin',
        30,
      );
    });
  } finally {
    getChartControlPanelRegistry().remove('table');
    jest.restoreAllMocks();
  }
});
