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
import { ComponentType } from 'react';
import { FeatureFlag } from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import downloadAsImage from 'src/utils/downloadAsImage';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import {
  useExploreAdditionalActionsMenu,
  getExportScreenshotMenuItems,
  escapeCsvValue,
} from './index';
import * as exploreUtils from 'src/explore/exploreUtils';
import { Slice } from 'src/types/Chart';

jest.mock('src/explore/exploreUtils', () => ({
  __esModule: true,
  ...jest.requireActual('src/explore/exploreUtils'),
  exportChart: jest.fn(),
  getChartKey: jest.fn(() => 'test_chart_key'),
}));

jest.mock('src/utils/downloadAsImage', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
}));
jest.mock('src/utils/downloadAsPdf', () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
}));

const mockDownloadAsImage = downloadAsImage as jest.MockedFunction<
  typeof downloadAsImage
>;
const mockDownloadAsPdf = downloadAsPdf as jest.MockedFunction<
  typeof downloadAsPdf
>;

const mockExportChart = exploreUtils.exportChart as jest.Mock;

const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: (component: ComponentType) => component,
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
    addSuccessToast: jest.fn(),
  }),
}));

jest.mock('src/logger/actions', () => ({
  logEvent: jest.fn(() => ({ type: 'LOG_EVENT' })),
}));

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: jest.fn(() => ({
    get: jest.fn(() => ({ behaviors: ['EXPORT_CURRENT_VIEW'] })),
  })),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({
    common: {
      user_subjects: [1],
    },
  })),
}));

const defaultProps = {
  latestQueryFormData: {
    datasource: '1__table',
    viz_type: 'pivot_table_v2',
  },
  canDownloadCSV: true,
  slice: { slice_id: 1, slice_name: 'Test Chart' } as unknown as Slice,
  ownState: {},
  dashboards: [],
  onOpenInEditor: jest.fn(),
  onOpenPropertiesModal: jest.fn(),
  showReportModal: jest.fn(),
  setCurrentReportDeleting: jest.fn(),
};

type TestComponentProps = typeof defaultProps;
type HookParams = Parameters<typeof useExploreAdditionalActionsMenu>;

const TestComponent = (props: TestComponentProps) => {
  const [menu] = useExploreAdditionalActionsMenu(
    props.latestQueryFormData as HookParams[0],
    props.canDownloadCSV,
    props.slice as HookParams[2],
    props.onOpenInEditor,
    props.onOpenPropertiesModal,
    props.ownState as HookParams[5],
    props.dashboards as HookParams[6],
    props.showReportModal,
    props.setCurrentReportDeleting,
  );

  return <div>{menu}</div>;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockExportChart.mockResolvedValue(undefined);
});

test('hides Edit chart properties from a user who is not an owner/editor of the chart (regression #38884)', async () => {
  render(
    <TestComponent
      {...defaultProps}
      slice={
        {
          slice_id: 1,
          slice_name: 'Test Chart',
          editors: [2],
        } as unknown as Slice
      }
    />,
    { useRedux: true },
  );

  expect(await screen.findByText('Data Export Options')).toBeInTheDocument();
  expect(screen.queryByText('Edit chart properties')).not.toBeInTheDocument();
});

test('shows Edit chart properties for a chart editor with chart write permission', async () => {
  render(
    <TestComponent
      {...defaultProps}
      slice={
        {
          slice_id: 1,
          slice_name: 'Test Chart',
          editors: [1],
        } as unknown as Slice
      }
    />,
    { useRedux: true, initialState: { explore: { can_add: true } } },
  );

  expect(await screen.findByText('Data Export Options')).toBeInTheDocument();
  expect(screen.getByText('Edit chart properties')).toBeInTheDocument();
});

test('hides Edit chart properties from a chart editor lacking chart write permission', async () => {
  render(
    <TestComponent
      {...defaultProps}
      slice={
        {
          slice_id: 1,
          slice_name: 'Test Chart',
          editors: [1],
        } as unknown as Slice
      }
    />,
    { useRedux: true, initialState: { explore: { can_add: false } } },
  );

  expect(await screen.findByText('Data Export Options')).toBeInTheDocument();
  expect(screen.queryByText('Edit chart properties')).not.toBeInTheDocument();
});

test('escapeCsvValue neutralizes spreadsheet formula prefixes', () => {
  // Mirrors superset/utils/csv.py escape_value so the client-built
  // "Current View" CSV cannot ship live formulas (CSV injection).
  expect(escapeCsvValue('=HYPERLINK("https://attacker.example")')).toBe(
    `"'=HYPERLINK(""https://attacker.example"")"`,
  );
  expect(escapeCsvValue('@SUM(1+1)')).toBe(`'@SUM(1+1)`);
  expect(escapeCsvValue('+cmd')).toBe(`'+cmd`);
  expect(escapeCsvValue('%x')).toBe(`'%x`);
  expect(escapeCsvValue('\t=1+1')).toBe(`'\t=1+1`);
  expect(escapeCsvValue('  =1+1')).toBe(`'  =1+1`);
  expect(escapeCsvValue('=cmd|calc')).toBe(`'=cmd\\|calc`);
});

test('escapeCsvValue escapes pre-existing backslashes before escaping pipes', () => {
  // A literal backslash sitting next to a pipe must not be left as-is: if it
  // were, the escaped output (`\|`) would be indistinguishable from an
  // escaped pipe, so a downstream unescaper couldn't recover the original
  // value. Escaping backslashes first keeps the two cases unambiguous.
  expect(escapeCsvValue('=cmd\\|calc')).toBe(`'=cmd\\\\\\|calc`);
});

test('escapeCsvValue RFC-4180-quotes a value containing a bare carriage return', () => {
  // A raw \r inside a cell can be read as a record separator by some CSV
  // consumers, so it must trigger outer quoting the same way \n does, even
  // when it also triggered the formula-prefix guard above.
  expect(escapeCsvValue('\r=1+1')).toBe(`"'\r=1+1"`);
});

test('escapeCsvValue keeps ordinary values intact', () => {
  expect(escapeCsvValue('regular text')).toBe('regular text');
  expect(escapeCsvValue('-12.5')).toBe('-12.5');
  expect(escapeCsvValue(42)).toBe('42');
  expect(escapeCsvValue(null)).toBe('');
  expect(escapeCsvValue(undefined)).toBe('');
  expect(escapeCsvValue('a,b')).toBe(`"a,b"`);
  expect(escapeCsvValue('say "hi"')).toBe(`"say ""hi"""`);
});

test('shows 413 error toast when exportCSV fails with 413', async () => {
  mockExportChart.mockRejectedValue({ status: 413 });

  render(<TestComponent {...defaultProps} />, { useRedux: true });

  userEvent.hover(await screen.findByText('Data Export Options'));
  userEvent.hover(await screen.findByText('Export All Data'));
  userEvent.click(await screen.findByText('Export to original .CSV'));

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/The chart data is too large to download/),
    );
  });
});

test('shows 413 error toast when exportCSVPivoted fails with 413', async () => {
  mockExportChart.mockRejectedValue({ status: 413 });

  render(<TestComponent {...defaultProps} />, { useRedux: true });

  userEvent.hover(await screen.findByText('Data Export Options'));
  userEvent.hover(await screen.findByText('Export All Data'));
  userEvent.click(await screen.findByText('Export to pivoted .CSV'));

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/The chart data is too large to download/),
    );
  });
});

test('shows 413 error toast when Export Current View CSV server path fails with 413', async () => {
  mockExportChart.mockRejectedValue({ status: 413 });

  render(
    <TestComponent
      {...defaultProps}
      latestQueryFormData={{
        datasource: '1__table',
        viz_type: 'table',
      }}
      ownState={{}}
    />,
    { useRedux: true },
  );

  userEvent.hover(await screen.findByText('Data Export Options'));
  userEvent.hover(await screen.findByText('Export Current View'));
  userEvent.click(await screen.findByText('Export to .CSV'));

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(/The chart data is too large to download/),
    );
  });
});

const CHART_SELECTOR = '.panel-body .chart-container';
const SLICE_NAME = 'My chart';
const CHART_ID = 42;
const domEvent = {} as React.MouseEvent;

const buildScreenshotItems = () => {
  const setIsDropdownVisible = jest.fn();
  const dispatch = jest.fn();
  const items = getExportScreenshotMenuItems({
    chartSelector: CHART_SELECTOR,
    sliceName: SLICE_NAME,
    chartId: CHART_ID,
    theme: {} as any,
    setIsDropdownVisible,
    dispatch,
    submenuKey: 'export_png_submenu',
    transparentKey: 'export_png_transparent',
    solidKey: 'export_png_solid',
    pdfKey: 'export_pdf',
  }) as any[];
  return { items, setIsDropdownVisible, dispatch };
};

test('getExportScreenshotMenuItems builds the PNG submenu and PDF item with the provided keys', () => {
  const { items } = buildScreenshotItems();
  const [pngSubmenu, pdfItem] = items;

  expect(pngSubmenu.key).toBe('export_png_submenu');
  expect(pngSubmenu.children).toHaveLength(2);
  expect(pngSubmenu.children[0].key).toBe('export_png_transparent');
  expect(pngSubmenu.children[1].key).toBe('export_png_solid');
  expect(pdfItem.key).toBe('export_pdf');
});

test('getExportScreenshotMenuItems transparent option downloads a transparent PNG and dispatches a log event', () => {
  const { items, setIsDropdownVisible, dispatch } = buildScreenshotItems();

  items[0].children[0].onClick({ domEvent });

  expect(mockDownloadAsImage).toHaveBeenCalledWith(
    CHART_SELECTOR,
    SLICE_NAME,
    true,
    expect.anything(),
    { format: 'png', backgroundType: 'transparent' },
  );
  expect(setIsDropdownVisible).toHaveBeenCalledWith(false);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test('getExportScreenshotMenuItems solid option downloads a solid PNG and dispatches a log event', () => {
  const { items, setIsDropdownVisible, dispatch } = buildScreenshotItems();

  items[0].children[1].onClick({ domEvent });

  expect(mockDownloadAsImage).toHaveBeenCalledWith(
    CHART_SELECTOR,
    SLICE_NAME,
    true,
    expect.anything(),
    { format: 'png', backgroundType: 'solid' },
  );
  expect(setIsDropdownVisible).toHaveBeenCalledWith(false);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

test('getExportScreenshotMenuItems PDF option calls downloadAsPdf and dispatches a log event', () => {
  const { items, setIsDropdownVisible, dispatch } = buildScreenshotItems();

  items[1].onClick({ domEvent });

  expect(mockDownloadAsPdf).toHaveBeenCalledWith(
    CHART_SELECTOR,
    SLICE_NAME,
    true,
  );
  expect(setIsDropdownVisible).toHaveBeenCalledWith(false);
  expect(dispatch).toHaveBeenCalledTimes(1);
});

/**
 * The version-history gate, exercised against the state shape hydrateExplore
 * actually produces rather than a mocked can_overwrite. Every seeded chart
 * ships with an empty editors list, so a membership-only gate hid the action
 * from everyone on a fresh install.
 */
const renderMenuFor = (
  slice: Record<string, unknown>,
  user: Record<string, unknown>,
) =>
  render(<TestComponent {...defaultProps} slice={slice as never} />, {
    useRedux: true,
    initialState: {
      user,
      explore: { can_overwrite: false, slice },
    },
  });

const adminUser = {
  userId: 1,
  username: 'admin',
  permissions: {},
  roles: { Admin: [] },
};

const gammaUser = {
  userId: 2,
  username: 'gamma',
  permissions: {},
  roles: { Gamma: [] },
};

test('an admin sees version history on a chart that has no editors', async () => {
  window.featureFlags = { [FeatureFlag.VersionHistory]: true };

  renderMenuFor(
    { slice_id: 1, slice_name: 'Test Chart', editors: [] },
    adminUser,
  );

  expect(await screen.findByText('View version history')).toBeInTheDocument();
});

test('a non-editor without the admin role does not', async () => {
  window.featureFlags = { [FeatureFlag.VersionHistory]: true };

  renderMenuFor(
    { slice_id: 1, slice_name: 'Test Chart', editors: [] },
    gammaUser,
  );

  await screen.findByText('View query');
  expect(screen.queryByText('View version history')).not.toBeInTheDocument();
});

test('the item stays hidden while the feature flag is off', async () => {
  window.featureFlags = { [FeatureFlag.VersionHistory]: false };

  renderMenuFor(
    { slice_id: 1, slice_name: 'Test Chart', editors: [] },
    adminUser,
  );

  await screen.findByText('View query');
  expect(screen.queryByText('View version history')).not.toBeInTheDocument();
});
