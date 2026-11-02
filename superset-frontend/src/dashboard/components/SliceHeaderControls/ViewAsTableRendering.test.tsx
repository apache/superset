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

// SliceHeaderControls.test.tsx mocks DataTablesPane's ResultsPaneOnDashboard
// entirely, which lets every test there confirm the *permission gating* and
// the *verbose_map computed for it* -- but none of them render the real
// grid. That leaves the actual "View as table" render path -- the thing
// apache/superset#41268 reports as silently broken for an embedded/guest-ish
// role -- with no coverage. This file renders the real ResultsPaneOnDashboard
// (no DataTablesPane mock) so the permission check, the drill_info fetch,
// the verbose_map, and the grid render are exercised end to end, the same
// way a user clicking "View as table" would hit them.
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { FeatureFlag, VizType } from '@superset-ui/core';
import { setupAGGridModules } from '@superset-ui/core/components/ThemedAgGridReact';
import mockState from 'spec/fixtures/mockState';
import { cachedSupersetGet } from 'src/utils/cachedSupersetGet';
import { getChartDataRequest } from 'src/components/Chart/chartAction';
import SliceHeaderControls, { SliceHeaderControlsProps } from '.';

jest.mock('src/utils/cachedSupersetGet');
jest.mock('src/components/Chart/chartAction', () => ({
  getChartDataRequest: jest.fn(),
}));
jest.mock('src/utils/downloadAsImage', () =>
  jest.fn(() => jest.fn().mockResolvedValue(undefined)),
);
jest.mock('src/utils/downloadAsPdf', () =>
  jest.fn(() => jest.fn().mockResolvedValue(undefined)),
);

const mockCachedSupersetGet = cachedSupersetGet as jest.MockedFunction<
  typeof cachedSupersetGet
>;
const mockGetChartDataRequest = getChartDataRequest as jest.MockedFunction<
  typeof getChartDataRequest
>;

const SLICE_ID = 27;
const DATASOURCE_ID = 58;

// Mirrors the chart from apache/superset#41268: a count grouped by a
// dimension, with a `contribution` post-processing column -- and the exact
// colnames/coltypes/data/rowcount the reporter captured from the API.
const createProps = () =>
  ({
    addDangerToast: jest.fn(),
    addSuccessToast: jest.fn(),
    exploreChart: jest.fn(),
    exportCSV: jest.fn(),
    exportFullCSV: jest.fn(),
    exportXLSX: jest.fn(),
    exportFullXLSX: jest.fn(),
    exportPivotExcel: jest.fn(),
    forceRefresh: jest.fn(),
    handleToggleFullSize: jest.fn(),
    toggleExpandSlice: jest.fn(),
    logEvent: jest.fn(),
    slice: {
      slice_id: SLICE_ID,
      slice_url: `/explore/?form_data=%7B%22slice_id%22%3A%20${SLICE_ID}%7D`,
      slice_name: 'Patients by specialty',
      slice_description: '',
      form_data: {
        adhoc_filters: [],
        color_scheme: 'supersetColors',
        datasource: `${DATASOURCE_ID}__table`,
        groupby: ['speciality'],
        metrics: ['COUNT(id)'],
        post_processing: [
          {
            operation: 'contribution',
            options: {
              columns: ['COUNT(id)'],
              rename_columns: ['COUNT(id)__contribution'],
            },
          },
        ],
        row_limit: 10000,
        slice_id: SLICE_ID,
        time_range: 'No filter',
        url_params: {},
        viz_type: VizType.Table,
      },
      viz_type: VizType.Table,
      datasource: `${DATASOURCE_ID}__table`,
      description: '',
      description_markeddown: '',
      modified: '<span class="no-wrap">22 hours ago</span>',
      changed_on: 1617143411523,
      editors: [],
    },
    isCached: [false],
    isExpanded: false,
    cachedDttm: [''],
    updatedDttm: 1617213803803,
    supersetCanExplore: false,
    supersetCanDownload: true,
    componentId: 'CHART-fYo7IyvKZQ',
    dashboardId: 26,
    isFullSize: false,
    chartStatus: 'rendered',
    showControls: true,
    supersetCanShare: true,
    formData: {
      slice_id: SLICE_ID,
      datasource: `${DATASOURCE_ID}__table`,
      viz_type: VizType.Table,
      groupby: ['speciality'],
      metrics: ['COUNT(id)'],
      row_limit: 10000,
    },
    exploreUrl: '/explore',
    defaultOpen: true,
  }) as SliceHeaderControlsProps;

// A role with the reporter's exact permission shape: `can_view_chart_as_table`
// and `can_get_drill_info`, but not `can_explore` (they granted
// `can_explore_json` on Superset, a different permission that does not
// satisfy `canExplore` in usePermissions).
const EMBED_LIKE_ROLE = {
  Gamma: [
    ['can_view_chart_as_table', 'Dashboard'],
    ['can_get_drill_info', 'Dataset'],
    ['can_drill', 'Dashboard'],
    ['can_samples', 'Datasource'],
  ],
};

const renderWrapper = () =>
  render(<SliceHeaderControls {...createProps()} />, {
    useRedux: true,
    useRouter: true,
    initialState: {
      ...mockState,
      user: {
        ...mockState.user,
        roles: EMBED_LIKE_ROLE,
      },
    },
  });

const openViewAsTable = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'More Options' }));
  await userEvent.click(screen.getByTestId('view-query-menu-item'));
};

beforeAll(() => {
  setupAGGridModules();
});

beforeEach(() => {
  (global as any).featureFlags = {
    [FeatureFlag.DrillToDetail]: false,
  };
  mockCachedSupersetGet.mockReset();
  mockGetChartDataRequest.mockReset();
});

test('"View as table" renders the actual rows and headers for a view-as-table-only role', async () => {
  // Post-#43719 drill_info shape: metrics are present (pre-#43719 the
  // schema had no metrics field at all), labels equal to the raw names
  // here -- same as the reporter's dataset, which never set custom labels.
  mockCachedSupersetGet.mockResolvedValue({
    response: {} as Response,
    json: {
      result: {
        columns: [{ column_name: 'speciality', verbose_name: null }],
        metrics: [{ metric_name: 'COUNT(id)', verbose_name: null }],
      },
    },
  } as any);
  mockGetChartDataRequest.mockResolvedValue({
    json: {
      result: [
        {
          colnames: ['speciality', 'COUNT(id)', 'COUNT(id)__contribution'],
          coltypes: [1, 0, 0],
          data: [
            {
              speciality: 'Dental',
              'COUNT(id)': 100,
              'COUNT(id)__contribution': 0.2,
            },
            {
              speciality: 'ENT',
              'COUNT(id)': 100,
              'COUNT(id)__contribution': 0.2,
            },
            {
              speciality: 'Eye',
              'COUNT(id)': 100,
              'COUNT(id)__contribution': 0.2,
            },
            {
              speciality: 'Heart',
              'COUNT(id)': 100,
              'COUNT(id)__contribution': 0.2,
            },
            {
              speciality: 'Tech',
              'COUNT(id)': 100,
              'COUNT(id)__contribution': 0.2,
            },
          ],
          rowcount: 5,
          sql_rowcount: 5,
        },
      ],
    },
  } as any);

  renderWrapper();
  await openViewAsTable();

  // The row count label is a plain React-rendered span, not subject to
  // ag-grid's row virtualization, so it is the most reliable signal that
  // `useResultsPane` actually resolved with 5 rows rather than getting
  // stuck in its loading state (#41268's reported symptom) or landing on
  // the error/empty-results branches. Both the chart-data fetch and the
  // drill_info fetch resolve independently and each triggers a re-render
  // (verbose_map arriving can swap ag-grid's columnDefs), so this re-queries
  // fresh on every attempt via `waitFor` rather than reusing a node handle
  // from an earlier `findByText` that a later re-render could detach.
  await waitFor(() => {
    expect(screen.getByText('5 rows')).toBeVisible();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Failed to load results'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('No results were returned for this query'),
    ).not.toBeInTheDocument();
  });

  // The grid itself must have actually received the fetched rows. ag-grid
  // virtualizes row rendering based on measured container height, which
  // jsdom (no real layout engine) reports as 0 inside this resizable modal,
  // so the cells it does render are not reliably `toBeVisible()` here --
  // but they must still be in the document with the right text.
  await waitFor(() => {
    expect(screen.getByText('Dental')).toBeInTheDocument();
    expect(screen.getByText('ENT')).toBeInTheDocument();
    expect(screen.getByText('Eye')).toBeInTheDocument();
    expect(screen.getByText('Heart')).toBeInTheDocument();
    expect(screen.getByText('Tech')).toBeInTheDocument();
  });

  // Headers come from the column names via the drill_info verbose_map
  // (null verbose_name falls back to the raw name).
  await waitFor(() => {
    expect(screen.getAllByText('speciality').length).toBeGreaterThan(0);
    expect(screen.getAllByText('COUNT(id)').length).toBeGreaterThan(0);
  });
});

test('"View as table" does not get stuck loading when drill_info 403s for a view-as-table-only role', async () => {
  mockCachedSupersetGet.mockRejectedValue(
    new Error('403: Forbidden (simulated)'),
  );
  mockGetChartDataRequest.mockResolvedValue({
    json: {
      result: [
        {
          colnames: ['speciality', 'COUNT(id)'],
          coltypes: [1, 0],
          data: [{ speciality: 'Dental', 'COUNT(id)': 100 }],
          rowcount: 1,
        },
      ],
    },
  } as any);

  renderWrapper();
  await openViewAsTable();

  // Even if drill_info fails, the chart-data fetch should still resolve and
  // the grid should still render using raw column names -- a failure here
  // (e.g. a stuck spinner) would mean the drill_info request's rejection is
  // somehow propagating into the results fetch rather than staying
  // contained to the verbose-map fallback.
  await waitFor(() => expect(mockGetChartDataRequest).toHaveBeenCalledTimes(1));
  await waitFor(() => {
    expect(screen.getByText('1 row')).toBeVisible();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByText('Dental')).toBeInTheDocument();
  });
});
