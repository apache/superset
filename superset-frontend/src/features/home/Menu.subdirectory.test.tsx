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
import * as reactRedux from 'react-redux';
import fetchMock from 'fetch-mock';
import { BrowserRouter } from 'react-router-dom';
import { QueryParamProvider } from 'use-query-params';
import { ReactRouter5Adapter } from 'use-query-params/adapters/react-router-5';
import { render, screen } from 'spec/helpers/testing-library';
import * as CoreTheme from '@apache-superset/core/theme';

// Menu's brand link statically reads applicationRoot(); intercept it to
// simulate a subdirectory deployment.
const mockApplicationRoot = jest.fn<string, []>(() => '');

jest.mock('src/utils/getBootstrapData', () => {
  const actual = jest.requireActual<
    typeof import('src/utils/getBootstrapData')
  >('src/utils/getBootstrapData');
  return {
    __esModule: true,
    default: actual.default,
    applicationRoot: () => mockApplicationRoot(),
    staticAssetsPrefix: actual.staticAssetsPrefix,
  };
});

jest.mock('@apache-superset/core/theme', () => ({
  ...jest.requireActual('@apache-superset/core/theme'),
  useTheme: jest.fn(),
}));

jest.mock('antd', () => ({
  ...jest.requireActual('antd'),
  Grid: {
    ...jest.requireActual('antd').Grid,
    useBreakpoint: () => ({ md: true }),
  },
}));

// IMPORTANT: unlike Menu.test.tsx this file does NOT mock GenericLink. It
// renders the real react-router-dom <Link> under a real
// `<BrowserRouter basename={APP_ROOT}>` — the same seam production builds via
// `<Router basename={applicationRoot()}>` in src/views/App.tsx. BrowserRouter
// honours basename in createHref and re-prepends the root WITHOUT deduping, so
// this exercises the actual rendered href the user clicks. The seam mock in
// Menu.test.tsx (no basename) is blind to that re-prepend; this file covers it.

// eslint-disable-next-line import/first
import { Menu } from './Menu';

const APP_ROOT = '/superset';

const user = {
  createdOn: '2021-04-27T18:12:38.952304',
  email: 'admin',
  firstName: 'admin',
  isActive: true,
  lastName: 'admin',
  permissions: {},
  roles: {
    Admin: [
      ['can_sqllab', 'Superset'],
      ['can_write', 'Dashboard'],
      ['can_write', 'Chart'],
    ],
  },
  userId: 1,
  username: 'admin',
};

const mockedProps = {
  user,
  data: {
    menu: [],
    brand: {
      path: '/superset/welcome/',
      icon: '/static/assets/images/superset-logo-horiz.png',
      alt: 'Apache Superset',
      width: '126',
      tooltip: '',
      text: '',
    },
    environment_tag: {
      text: 'Production',
      color: '#000',
    },
    navbar_right: {
      show_watermark: false,
      bug_report_url: '/report/',
      documentation_url: '/docs/',
      languages: {
        en: { flag: 'us', name: 'English', url: '/lang/en' },
      },
      show_language_picker: true,
      user_is_anonymous: true,
      user_info_url: '/users/userinfo/',
      user_logout_url: '/logout/',
      user_login_url: '/login/',
      locale: 'en',
      version_string: '1.0.0',
      version_sha: 'randomSHA',
      build_number: 'randomBuildNumber',
    },
    settings: [],
  },
};

const useSelectorMock = jest.spyOn(reactRedux, 'useSelector');
const useThemeMock = CoreTheme.useTheme as jest.Mock;

fetchMock.get(
  'glob:*api/v1/database/?q=(filters:!((col:allow_file_upload,opr:upload_is_enabled,value:!t)))',
  {},
);

const renderUnderSubdirectory = () =>
  render(
    // Mirror production's `<Router basename={applicationRoot()}>`
    // (views/App.tsx). BrowserRouter honours basename in createHref, so a
    // router-relative `to` is re-prefixed exactly once — the seam the brand
    // link's strip must feed correctly.
    <BrowserRouter basename={APP_ROOT}>
      <QueryParamProvider adapter={ReactRouter5Adapter}>
        <Menu {...mockedProps} />
      </QueryParamProvider>
    </BrowserRouter>,
    { useRedux: true, useTheme: true },
  );

beforeEach(() => {
  mockApplicationRoot.mockReturnValue(APP_ROOT);
  useSelectorMock.mockReturnValue({ roles: user.roles });
  // Keep the page URL under the basename so BrowserRouter is consistent.
  window.history.replaceState({}, '', `${APP_ROOT}/welcome/`);
});

afterEach(() => {
  window.history.replaceState({}, '', '/');
  useSelectorMock.mockClear();
  jest.restoreAllMocks();
});

test('brand logo link is single-prefixed when brandLogoHref arrives already rooted', async () => {
  // The backend emits brandLogoHref already carrying the app root. The Router
  // basename re-prepends the root, so the strip must run first to avoid a
  // doubled /superset/superset/... href in the rendered anchor.
  useThemeMock.mockReturnValue({
    ...CoreTheme.supersetTheme,
    brandLogoUrl: '/static/assets/images/custom-logo.png',
    brandLogoHref: '/superset/welcome/',
  });

  renderUnderSubdirectory();

  const brandLink = await screen.findByRole('link', {
    name: /apache superset/i,
  });
  expect(brandLink).toHaveAttribute('href', '/superset/welcome/');
  expect(brandLink.getAttribute('href')).not.toContain('/superset/superset');
});

test('brand logo link is single-prefixed when brandLogoHref is a bare path', async () => {
  // A bare (un-rooted) brandLogoHref must end up prefixed exactly once after
  // the Router basename re-prepend.
  useThemeMock.mockReturnValue({
    ...CoreTheme.supersetTheme,
    brandLogoUrl: '/static/assets/images/custom-logo.png',
    brandLogoHref: '/welcome/',
  });

  renderUnderSubdirectory();

  const brandLink = await screen.findByRole('link', {
    name: /apache superset/i,
  });
  expect(brandLink).toHaveAttribute('href', '/superset/welcome/');
  expect(brandLink.getAttribute('href')).not.toContain('/superset/superset');
});

test('brand logo link renders without crashing when brandLogoHref is unset (partial theme override)', async () => {
  // A partial theme override can set brandLogoUrl (the image) while leaving
  // brandLogoHref undefined. The internal branch must stay null-safe: stripping
  // the ensureAppRoot'd value (which falls back to the app root for an undefined
  // input) avoids a `undefined.startsWith` TypeError that would white-screen the
  // nav chrome. The rendered href resolves to the app root, never doubled.
  useThemeMock.mockReturnValue({
    ...CoreTheme.supersetTheme,
    brandLogoUrl: '/static/assets/images/custom-logo.png',
    brandLogoHref: undefined,
  });

  renderUnderSubdirectory();

  const brandLink = await screen.findByRole('link', {
    name: /apache superset/i,
  });
  expect(brandLink.getAttribute('href')).toMatch(/^\/superset\/?$/);
  expect(brandLink.getAttribute('href')).not.toContain('/superset/superset');
});

test('external brandLogoHref passes through without app-root prefixing', async () => {
  useThemeMock.mockReturnValue({
    ...CoreTheme.supersetTheme,
    brandLogoUrl: '/static/assets/images/custom-logo.png',
    brandLogoHref: 'https://external.example.com',
  });

  renderUnderSubdirectory();

  const brandLink = await screen.findByRole('link', {
    name: /apache superset/i,
  });
  expect(brandLink).toHaveAttribute('href', 'https://external.example.com');
});
