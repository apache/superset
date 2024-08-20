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
import fetchMock from 'fetch-mock';
import * as uiCore from '@superset-ui/core';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import Welcome from 'src/pages/Home';
import { getExtensionsRegistry } from '@superset-ui/core';
import setupExtensions from 'src/setup/setupExtensions';

const chartsEndpoint = 'glob:*/api/v1/chart/?*';
const chartInfoEndpoint = 'glob:*/api/v1/chart/_info?*';
const chartFavoriteStatusEndpoint = 'glob:*/api/v1/chart/favorite_status?*';
const dashboardsEndpoint = 'glob:*/api/v1/dashboard/?*';
const dashboardInfoEndpoint = 'glob:*/api/v1/dashboard/_info?*';
const dashboardFavoriteStatusEndpoint =
  'glob:*/api/v1/dashboard/favorite_status/?*';
const savedQueryEndpoint = 'glob:*/api/v1/saved_query/?*';
const savedQueryInfoEndpoint = 'glob:*/api/v1/saved_query/_info?*';
const recentActivityEndpoint = 'glob:*/api/v1/log/recent_activity/*';

fetchMock.get(chartsEndpoint, {
  result: [
    {
      slice_name: 'ChartyChart',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/explore',
      id: '4',
      table: {},
    },
  ],
});

fetchMock.get(dashboardsEndpoint, {
  result: [
    {
      dashboard_title: 'Dashboard_Test',
      changed_on_utc: '24 Feb 2014 10:13:14',
      url: '/fakeUrl/dashboard',
      id: '3',
    },
  ],
});

fetchMock.get(savedQueryEndpoint, {
  result: [],
});

fetchMock.get(recentActivityEndpoint, {
  Created: [],
  Viewed: [],
});

fetchMock.get(chartInfoEndpoint, {
  permissions: [],
});

fetchMock.get(chartFavoriteStatusEndpoint, {
  result: [],
});

fetchMock.get(dashboardInfoEndpoint, {
  permissions: [],
});

fetchMock.get(dashboardFavoriteStatusEndpoint, {
  result: [],
});

fetchMock.get(savedQueryInfoEndpoint, {
  permissions: [],
});

const mockedProps = {
  user: {
    username: 'alpha',
    firstName: 'alpha',
    lastName: 'alpha',
    createdOn: '2016-11-11T12:34:17',
    userId: 5,
    email: 'alpha@alpha.com',
    isActive: true,
    isAnonymous: false,
    permissions: {},
    roles: {
      sql_lab: [['can_read', 'SavedQuery']],
    },
  },
};

const mockedPropsWithoutSqlRole = {
  ...{
    ...mockedProps,
    user: {
      ...mockedProps.user,
      roles: {},
    },
  },
};

const setupFeatureToggleMock = () =>
  jest.spyOn(uiCore, 'isFeatureEnabled').mockReturnValue(true);

const renderWelcome = (props = mockedProps) =>
  waitFor(() => {
    render(<Welcome {...props} />, {
      useRedux: true,
      useRouter: true,
    });
  });

afterEach(() => {
  fetchMock.resetHistory();
});

test('With sql role - renders', async () => {
  await renderWelcome();
  expect(await screen.findByText('Dashboards')).toBeInTheDocument();
});

test('With sql role - renders all panels on the page on page load', async () => {
  await renderWelcome();
  const panels = await screen.findAllByText(
    /Dashboards|Charts|Recents|Saved queries/,
  );
  expect(panels).toHaveLength(4);
});

test('With sql role - calls api methods in parallel on page load', async () => {
  await renderWelcome();
  expect(fetchMock.calls(chartsEndpoint)).toHaveLength(2);
  expect(fetchMock.calls(recentActivityEndpoint)).toHaveLength(1);
  expect(fetchMock.calls(savedQueryEndpoint)).toHaveLength(1);
  expect(fetchMock.calls(dashboardsEndpoint)).toHaveLength(2);
});

test('Without sql role - renders', async () => {
  /*
  We ignore the ts error here because the type does not recognize the absence of a role entry
  */
  // @ts-ignore-next-line
  await renderWelcome(mockedPropsWithoutSqlRole);
  expect(await screen.findByText('Dashboards')).toBeInTheDocument();
});

test('Without sql role - renders all panels on the page on page load', async () => {
  // @ts-ignore-next-line
  await renderWelcome(mockedPropsWithoutSqlRole);
  const panels = await screen.findAllByText(/Dashboards|Charts|Recents/);
  expect(panels).toHaveLength(3);
});

test('Without sql role - calls api methods in parallel on page load', async () => {
  // @ts-ignore-next-line
  await renderWelcome(mockedPropsWithoutSqlRole);
  expect(fetchMock.calls(chartsEndpoint)).toHaveLength(2);
  expect(fetchMock.calls(recentActivityEndpoint)).toHaveLength(1);
  expect(fetchMock.calls(savedQueryEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(dashboardsEndpoint)).toHaveLength(2);
});

// Mock specific to the tests related to the toggle switch
fetchMock.get('glob:*/api/v1/dashboard/*', {
  result: {
    dashboard_title: 'Dashboard 4',
    changed_on_utc: '24 Feb 2014 10:13:14',
    url: '/fakeUrl/dashboard/4',
    id: '4',
  },
});

test('With toggle switch - shows a toggle button when feature flag is turned on', async () => {
  setupFeatureToggleMock();

  await renderWelcome();
  expect(screen.getByRole('switch')).toBeInTheDocument();
});

test('With toggle switch - does not show thumbnails when switch is off', async () => {
  setupFeatureToggleMock();

  await renderWelcome();
  const toggle = await screen.findByRole('switch');
  userEvent.click(toggle);
  expect(screen.queryByAltText('Thumbnails')).not.toBeInTheDocument();
});

test('Should render an extension component if one is supplied', async () => {
  const extensionsRegistry = getExtensionsRegistry();

  extensionsRegistry.set('welcome.banner', () => (
    <>welcome.banner extension component</>
  ));

  setupExtensions();

  await renderWelcome();

  expect(
    screen.getByText('welcome.banner extension component'),
  ).toBeInTheDocument();
});

test('Should render a submenu extension component if one is supplied', async () => {
  const extensionsRegistry = getExtensionsRegistry();

  extensionsRegistry.set('home.submenu', () => <>submenu extension</>);

  setupExtensions();

  await renderWelcome();

  expect(screen.getByText('submenu extension')).toBeInTheDocument();
});

test('Should not make data fetch calls if `welcome.main.replacement` is defined', async () => {
  const extensionsRegistry = getExtensionsRegistry();

  // Clean up
  extensionsRegistry.set('welcome.banner', () => null);

  // Set up
  extensionsRegistry.set('welcome.main.replacement', () => (
    <>welcome.main.replacement extension component</>
  ));

  setupExtensions();

  await renderWelcome();

  expect(
    screen.getByText('welcome.main.replacement extension component'),
  ).toBeInTheDocument();

  expect(fetchMock.calls(chartsEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(dashboardsEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(recentActivityEndpoint)).toHaveLength(0);
  expect(fetchMock.calls(savedQueryEndpoint)).toHaveLength(0);
});
