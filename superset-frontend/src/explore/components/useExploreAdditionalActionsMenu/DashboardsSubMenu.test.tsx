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
import { render, screen } from 'spec/helpers/testing-library';
import type { MenuItemType } from '@superset-ui/core/components';
import { useDashboardsMenuItems } from './DashboardsSubMenu';
import { SEARCH_THRESHOLD } from './index';

const TestDashboardsMenuItems = ({
  chartId,
  dashboards,
  searchTerm,
}: {
  chartId?: number;
  dashboards: { id: number; dashboard_title: string }[];
  searchTerm?: string;
}) => {
  const menuItems = useDashboardsMenuItems({
    chartId,
    dashboards,
    searchTerm,
  }) as MenuItemType[];
  return (
    <div data-test="menu-items">
      {menuItems.map(item => (
        <div key={item.key} data-test={`menu-item-${item!.key}`}>
          {typeof item.label === 'string' ? item!.label : 'Complex Label'}
          {item!.disabled && <span data-test="disabled">disabled</span>}
        </div>
      ))}
    </div>
  );
};

const createDashboards = (numberOfItems: number) => {
  const dashboards = [];
  for (let i = 1; i <= numberOfItems; i += 1) {
    dashboards.push({ id: i, dashboard_title: `Dashboard ${i}` });
  }
  return dashboards;
};

describe('DashboardsSubMenu', () => {
  test('exports SEARCH_THRESHOLD constant', () => {
    expect(SEARCH_THRESHOLD).toBe(10);
  });

  test('renders menu items for dashboards', () => {
    const dashboards = createDashboards(3);
    render(
      <TestDashboardsMenuItems
        chartId={123}
        dashboards={dashboards}
        searchTerm=""
      />,
      { useRouter: true },
    );

    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-3')).toBeInTheDocument();
  });

  test('filters dashboards based on search term', () => {
    const dashboards = createDashboards(20);
    render(
      <TestDashboardsMenuItems
        chartId={123}
        dashboards={dashboards}
        searchTerm="2"
      />,
      { useRouter: true },
    );

    // Should show Dashboard 2, Dashboard 12, and Dashboard 20
    expect(screen.getByTestId('menu-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-12')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-20')).toBeInTheDocument();

    // Should not show Dashboard 1
    expect(screen.queryByTestId('menu-item-1')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-item-3')).not.toBeInTheDocument();
  });

  test('returns "No results found" when search has no matches', () => {
    const dashboards = createDashboards(20);
    render(
      <TestDashboardsMenuItems
        chartId={123}
        dashboards={dashboards}
        searchTerm="unknown"
      />,
      { useRouter: true },
    );

    expect(screen.getByTestId('menu-item-no-results')).toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByTestId('disabled')).toBeInTheDocument();
  });

  test('returns "None" when no dashboards provided', () => {
    render(
      <TestDashboardsMenuItems chartId={123} dashboards={[]} searchTerm="" />,
      { useRouter: true },
    );

    expect(screen.getByTestId('menu-item-no-dashboards')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
    expect(screen.getByTestId('disabled')).toBeInTheDocument();
  });

  test('handles missing chart ID gracefully', () => {
    const dashboards = createDashboards(1);
    render(<TestDashboardsMenuItems dashboards={dashboards} searchTerm="" />, {
      useRouter: true,
    });

    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument();
  });

  test('case-insensitive search filtering', () => {
    const dashboards = [
      { id: 1, dashboard_title: 'Sales Dashboard' },
      { id: 2, dashboard_title: 'Marketing Dashboard' },
      { id: 3, dashboard_title: 'Analytics Dashboard' },
    ];

    render(
      <TestDashboardsMenuItems
        chartId={123}
        dashboards={dashboards}
        searchTerm="SALES"
      />,
      { useRouter: true },
    );

    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument();
    expect(screen.queryByTestId('menu-item-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-item-3')).not.toBeInTheDocument();
  });

  test('empty search term shows all dashboards', () => {
    const dashboards = createDashboards(5);
    render(
      <TestDashboardsMenuItems
        chartId={123}
        dashboards={dashboards}
        searchTerm=""
      />,
      { useRouter: true },
    );

    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-2')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-3')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-4')).toBeInTheDocument();
    expect(screen.getByTestId('menu-item-5')).toBeInTheDocument();
  });

  test('partial string search works correctly', () => {
    const dashboards = [
      { id: 1, dashboard_title: 'Revenue Report' },
      { id: 2, dashboard_title: 'User Engagement' },
      { id: 3, dashboard_title: 'Product Performance' },
    ];

    render(
      <TestDashboardsMenuItems
        chartId={123}
        dashboards={dashboards}
        searchTerm="port"
      />,
      { useRouter: true },
    );

    expect(screen.getByTestId('menu-item-1')).toBeInTheDocument(); // Revenue Report
    expect(screen.queryByTestId('menu-item-2')).not.toBeInTheDocument();
    expect(screen.queryByTestId('menu-item-3')).not.toBeInTheDocument();
  });
});
