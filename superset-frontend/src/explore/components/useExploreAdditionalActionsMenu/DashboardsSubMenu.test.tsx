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
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { Menu } from 'src/components/Menu';
import DashboardItems from './DashboardsSubMenu';

const asyncRender = (numberOfItems: number) => {
  const dashboards = [];
  for (let i = 1; i <= numberOfItems; i += 1) {
    dashboards.push({ id: i, dashboard_title: `Dashboard ${i}` });
  }
  render(
    <Menu openKeys={['menu']}>
      <Menu.SubMenu title="On dashboards" key="menu">
        <DashboardItems key="menu" dashboards={dashboards} />
      </Menu.SubMenu>
    </Menu>,
    {
      useRouter: true,
    },
  );
};

test('renders a submenu', async () => {
  asyncRender(3);
  await waitFor(() => {
    expect(screen.getByText('Dashboard 1')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 2')).toBeInTheDocument();
    expect(screen.getByText('Dashboard 3')).toBeInTheDocument();
  });
});

test('renders a submenu with search', async () => {
  asyncRender(20);
  expect(await screen.findByPlaceholderText('Search')).toBeInTheDocument();
});

test('displays a searched value', async () => {
  asyncRender(20);
  userEvent.type(screen.getByPlaceholderText('Search'), '2');
  expect(await screen.findByText('Dashboard 2')).toBeInTheDocument();
  expect(await screen.findByText('Dashboard 20')).toBeInTheDocument();
});

test('renders a "No results found" message when searching', async () => {
  asyncRender(20);
  userEvent.type(screen.getByPlaceholderText('Search'), 'unknown');
  expect(await screen.findByText('No results found')).toBeInTheDocument();
});

test('renders a submenu with no dashboards', async () => {
  asyncRender(0);
  expect(await screen.findByText('None')).toBeInTheDocument();
});

test('shows link icon when hovering', async () => {
  asyncRender(3);
  expect(screen.queryByRole('img', { name: 'full' })).not.toBeInTheDocument();
  userEvent.hover(await screen.findByText('Dashboard 1'));
  expect(
    (await screen.findAllByRole('img', { name: 'full' }))[0],
  ).toBeInTheDocument();
});
