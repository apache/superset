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
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import { useExploreAdditionalActionsMenu } from './index';
import * as exploreUtils from 'src/explore/exploreUtils';
import userEvent from '@testing-library/user-event';
import { VizType } from '@superset-ui/core';

// Mock exploreUtils
jest.mock('src/explore/exploreUtils', () => ({
  __esModule: true,
  ...jest.requireActual('src/explore/exploreUtils'),
  exportChart: jest.fn(),
  getChartKey: jest.fn(() => 'test_chart_key'),
}));

// Mock @superset-ui/core to ensure t is available
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  t: str => str,
  isFeatureEnabled: () => true, // default to true
}));

// Mock useToasts
const mockAddDangerToast = jest.fn();
jest.mock('src/components/MessageToasts/withToasts', () => ({
  __esModule: true,
  default: component => component,
  useToasts: () => ({
    addDangerToast: mockAddDangerToast,
    addSuccessToast: jest.fn(),
  }),
}));

const TestComponent = props => {
  const [menu] = useExploreAdditionalActionsMenu(
    props.latestQueryFormData,
    props.canDownloadCSV,
    props.slice,
    props.onOpenInEditor,
    props.onOpenPropertiesModal,
    props.ownState,
    props.dashboards,
    props.showReportModal,
    props.setCurrentReportDeleting,
  );

  return (
    <div>
      {/* Render buttons to trigger menu items */}
      {menu.map(item => {
        if (item && item.label && item.onClick) {
          return (
            <button key={item.key} onClick={item.onClick}>
              {typeof item.label === 'string' ? item.label : 'Complex Label'}
            </button>
          );
        }
        if (item && item.children) {
          return item.children.map(child => {
            if (child && child.label && child.onClick) {
              return (
                <button key={child.key} onClick={child.onClick}>
                  {typeof child.label === 'string'
                    ? child.label
                    : 'Complex Label'}
                </button>
              );
            }
            return null;
          });
        }
        return null;
      })}
    </div>
  );
};

test('shows 413 error toast when exportCSV fails with 413', async () => {
  const mockExportChart = exploreUtils.exportChart;
  const error413 = { status: 413 };
  mockExportChart.mockRejectedValue(error413);

  const props = {
    latestQueryFormData: { viz_type: 'table' },
    canDownloadCSV: true,
    slice: { slice_id: 1, slice_name: 'Test Chart' },
    ownState: {},
  };

  render(<TestComponent {...props} />, { useRedux: true });

  // Menu items might be nested. In the implementation, 'Export to original .CSV' is in a submenu.
  // The Component renders flattened buttons from recursive children?
  // Wait, my TestComponent only iterates one level deep for children.
  // Let's verify structure of menuItems in index.jsx

  // "Download submenu" logic:
  // menuItems.push({ key: MENU_KEYS.DOWNLOAD_SUBMENU, ..., children: allDataChildren })

  // So "Export to original .CSV" is inside children of a menu item.

  const exportButton = screen.getByText('Export to original .CSV');
  userEvent.click(exportButton);

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(
        /Export failed: The chart data is too large to download \(413\)/,
      ),
    );
  });
});

test('shows 413 error toast when exportCSVPivoted fails with 413', async () => {
  const mockExportChart = exploreUtils.exportChart;
  const error413 = { status: 413 };
  mockExportChart.mockRejectedValue(error413);

  const props = {
    latestQueryFormData: { viz_type: 'pivot_table_v2' },
    canDownloadCSV: true,
    slice: { slice_id: 1, slice_name: 'Test Chart' },
    ownState: {},
  };

  render(<TestComponent {...props} />, { useRedux: true });

  const exportButton = screen.getByText('Export to pivoted .CSV');
  userEvent.click(exportButton);

  await waitFor(() => {
    expect(mockAddDangerToast).toHaveBeenCalledWith(
      expect.stringMatching(
        /Export failed: The chart data is too large to download \(413\)/,
      ),
    );
  });
});
