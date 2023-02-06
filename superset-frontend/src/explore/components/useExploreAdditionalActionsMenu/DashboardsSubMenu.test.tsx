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
import userEvent from '@testing-library/user-event';
import { Menu } from 'src/components/Menu';
import DashboardItems from './DashboardsSubMenu';

const asyncRender = (numberOfItems: number) =>
  waitFor(() => {
    const dashboards = [];
    for (let i = 1; i <= numberOfItems; i += 1) {
      dashboards.push({ id: i, dashboard_title: `Dashboard ${i}` });
    }
    render(
      <Menu openKeys={['menu']}>
        <Menu.SubMenu title="Dashboards added to" key="menu">
          <DashboardItems key="menu" dashboards={dashboards} />
        </Menu.SubMenu>
      </Menu>,
      {
        useRouter: true,
      },
    );
  });

test('renders a submenu', async () => {
  await asyncRender(3);
  expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
  expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
  expect(screen.getByText('Dashboard 3')).toBeInTheDocument();
});

test('renders a submenu with search', async () => {
  await asyncRender(20);
  expect(screen.getByPlaceholderText('Search')).toBeInTheDocument();
});

test('displays a searched value', async () => {
  await asyncRender(20);
  userEvent.type(screen.getByPlaceholderText('Search'), '2');
  expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
  expect(screen.getByText('Dashboard 20')).toBeInTheDocument();
});

test('renders a "No results found" message when searching', async () => {
  await asyncRender(20);
  userEvent.type(screen.getByPlaceholderText('Search'), 'unknown');
  expect(screen.getByText('No results found')).toBeInTheDocument();
});

test('renders a submenu with no dashboards', async () => {
  await asyncRender(0);
  expect(screen.getByText('None')).toBeInTheDocument();
});

test('shows link icon when hovering', async () => {
  await asyncRender(3);
  expect(screen.queryByRole('img', { name: 'full' })).not.toBeInTheDocument();
  userEvent.hover(screen.getByText('Dashboard 1'));
  expect(screen.getByRole('img', { name: 'full' })).toBeInTheDocument();
});
