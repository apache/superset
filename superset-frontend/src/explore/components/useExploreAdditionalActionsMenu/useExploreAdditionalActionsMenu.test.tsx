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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import downloadAsImage from 'src/utils/downloadAsImage';
import downloadAsPdf from 'src/utils/downloadAsPdf';
import {
  useExploreAdditionalActionsMenu,
  getExportScreenshotMenuItems,
} from './index';
import * as exploreUtils from 'src/explore/exploreUtils';

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

const defaultProps = {
  latestQueryFormData: {
    datasource: '1__table',
    viz_type: 'pivot_table_v2',
  },
  canDownloadCSV: true,
  slice: { slice_id: 1, slice_name: 'Test Chart' },
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
