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
import { render, screen } from '@testing-library/react';
import { createWrapper } from 'spec/helpers/testing-library';
import DashboardLinksExternal from '.';

const mockDashboards = [
  {
    id: 1,
    dashboard_title: 'Sales Dashboard',
    url: '/dashboard/1/',
  },
  {
    id: 2,
    dashboard_title: 'Analytics Dashboard',
    url: '/dashboard/2/',
  },
  {
    id: 3,
    dashboard_title: 'Very Long Dashboard Name That Should Be Truncated',
    url: '/dashboard/3/',
  },
];

const setupTest = (dashboards = mockDashboards) =>
  render(<DashboardLinksExternal dashboards={dashboards} />, {
    wrapper: createWrapper({
      useRedux: true,
      useRouter: true,
    }),
  });

describe('DashboardLinksExternal', () => {
  test('renders empty state when no dashboards provided', () => {
    setupTest([]);
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('renders empty state when dashboards is null/undefined', () => {
    render(<DashboardLinksExternal dashboards={null as any} />, {
      wrapper: createWrapper({
        useRedux: true,
        useRouter: true,
      }),
    });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  test('renders single dashboard link correctly', () => {
    setupTest([mockDashboards[0]]);

    const link = screen.getByText('Sales Dashboard');
    expect(link).toBeInTheDocument();
    expect(link.closest('a')).toHaveAttribute('href', '/superset/dashboard/1/');
    expect(link.closest('a')).toHaveAttribute('target', '_blank');
  });

  test('renders multiple dashboard links with commas', () => {
    setupTest();

    expect(screen.getByText('Sales Dashboard')).toBeInTheDocument();
    expect(screen.getByText(', Analytics Dashboard')).toBeInTheDocument();
    expect(
      screen.getByText(', Very Long Dashboard Name That Should Be Truncated'),
    ).toBeInTheDocument();
  });

  test('all links open in new tabs', () => {
    setupTest();

    const links = screen.getAllByRole('link');
    links.forEach(link => {
      expect(link).toHaveAttribute('target', '_blank');
    });
  });

  test('links have correct href attributes', () => {
    setupTest();

    const salesLink = screen.getByText('Sales Dashboard').closest('a');
    const analyticsLink = screen
      .getByText(', Analytics Dashboard')
      .closest('a');
    const longNameLink = screen
      .getByText(', Very Long Dashboard Name That Should Be Truncated')
      .closest('a');

    expect(salesLink).toHaveAttribute('href', '/superset/dashboard/1/');
    expect(analyticsLink).toHaveAttribute('href', '/superset/dashboard/2/');
    expect(longNameLink).toHaveAttribute('href', '/superset/dashboard/3/');
  });

  test('applies correct styling classes', () => {
    setupTest();

    const truncatedSpan = document.querySelector('.truncated');
    expect(truncatedSpan).toBeInTheDocument();
    expect(truncatedSpan).toContainElement(screen.getAllByRole('link')[0]);
  });

  test('handles dashboard with empty title', () => {
    const dashboardWithEmptyTitle = [
      {
        id: 1,
        dashboard_title: '',
        url: '/dashboard/1/',
      },
    ];

    setupTest(dashboardWithEmptyTitle);

    const link = screen.getByRole('link');
    expect(link).toHaveTextContent('');
    expect(link).toHaveAttribute('href', '/superset/dashboard/1/');
  });
});
