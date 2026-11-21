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

/**
 * The `home.section` view location.
 *
 * In its own file because the extension registries involved are module-level
 * state: the Home tests next door leave a `welcome.main.replacement` override
 * in place, and that override replaces the whole section list this location
 * lives in.
 */

// Imported first: loading this before 'spec/helpers/testing-library' or
// '@superset-ui/core' ensures mockAntdWithDesktopBreakpoint is defined
// before anything transitively requires (and thus mocks) 'antd'.
import { mockAntdWithDesktopBreakpoint } from 'spec/helpers/mobileTestUtils';
import fetchMock from 'fetch-mock';
import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import { views, ViewLocations } from 'src/core';
import Welcome from 'src/pages/Home';

jest.mock('antd', () => mockAntdWithDesktopBreakpoint());

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

fetchMock.get(chartsEndpoint, { result: [] });
fetchMock.get(dashboardsEndpoint, { result: [] });
fetchMock.get(savedQueryEndpoint, { result: [] });
fetchMock.get(recentActivityEndpoint, { result: [] });
fetchMock.get(chartInfoEndpoint, { permissions: [] });
fetchMock.get(chartFavoriteStatusEndpoint, { result: [] });
fetchMock.get(dashboardInfoEndpoint, { permissions: [] });
fetchMock.get(dashboardFavoriteStatusEndpoint, { result: [] });
fetchMock.get(savedQueryInfoEndpoint, { permissions: [] });

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

const SECTION_ID = 'acme.reviews.home';

const renderWelcome = () =>
  waitFor(() => {
    render(<Welcome {...mockedProps} />, {
      useRedux: true,
      useRouter: true,
    });
  });

const registerSection = () =>
  views.registerView(
    { id: SECTION_ID, name: 'Contributed section' },
    ViewLocations.home.section,
    () => <div>Contributed section body</div>,
  );

const disposables: Array<{ dispose: () => void }> = [];

afterEach(() => {
  disposables.forEach(d => d.dispose());
  disposables.length = 0;
  fetchMock.clearHistory();
});

test('contributes no section by default', async () => {
  await renderWelcome();

  expect(await screen.findByText('Dashboards')).toBeInTheDocument();
  expect(screen.queryByText('Contributed section')).not.toBeInTheDocument();
});

test('a view registered at home.section becomes a section of the page', async () => {
  disposables.push(registerSection());

  await renderWelcome();

  // The view's name is the section heading, and -- like the host's own
  // sections -- the panel it heads starts collapsed.
  expect(
    await screen.findByRole('button', { name: 'Contributed section' }),
  ).toBeInTheDocument();
  expect(
    screen.queryByText('Contributed section body'),
  ).not.toBeInTheDocument();
});

test('the contributed component renders when the section is opened', async () => {
  disposables.push(registerSection());

  await renderWelcome();

  await userEvent.click(
    await screen.findByRole('button', { name: 'Contributed section' }),
  );

  expect(
    await screen.findByText('Contributed section body'),
  ).toBeInTheDocument();
});

test('a contributed section sits after the host’s own', async () => {
  disposables.push(registerSection());

  await renderWelcome();

  const headings = (
    await screen.findAllByRole('button', {
      name: /Recents|Dashboards|Charts|Saved queries|Contributed section/,
    })
  ).map(heading => heading.textContent);

  expect(headings[headings.length - 1]).toContain('Contributed section');
});

test('a view registered after the first render still appears', async () => {
  await renderWelcome();
  expect(await screen.findByText('Dashboards')).toBeInTheDocument();
  expect(screen.queryByText('Contributed section')).not.toBeInTheDocument();

  act(() => {
    disposables.push(registerSection());
  });

  expect(
    await screen.findByRole('button', { name: 'Contributed section' }),
  ).toBeInTheDocument();
});

test('disposing the view removes the section', async () => {
  const disposable = registerSection();

  await renderWelcome();
  expect(
    await screen.findByRole('button', { name: 'Contributed section' }),
  ).toBeInTheDocument();

  act(() => {
    disposable.dispose();
  });

  expect(screen.queryByText('Contributed section')).not.toBeInTheDocument();
});
