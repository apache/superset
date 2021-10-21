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
import { render, screen } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import { Menu } from './Menu';
import { dropdownItems } from './MenuRight';

const mockedProps = {
  data: {
    menu: [
      {
        name: 'Home',
        icon: '',
        label: 'Home',
        url: '/superset/welcome',
        index: 1,
      },
      {
        name: 'Sources',
        icon: 'fa-table',
        label: 'Sources',
        index: 2,
        childs: [
          {
            name: 'Datasets',
            icon: 'fa-table',
            label: 'Datasets',
            url: '/tablemodelview/list/',
            index: 1,
          },
          '-',
          {
            name: 'Databases',
            icon: 'fa-database',
            label: 'Databases',
            url: '/databaseview/list/',
            index: 2,
          },
        ],
      },
      {
        name: 'Charts',
        icon: 'fa-bar-chart',
        label: 'Charts',
        url: '/chart/list/',
        index: 3,
      },
      {
        name: 'Dashboards',
        icon: 'fa-dashboard',
        label: 'Dashboards',
        url: '/dashboard/list/',
        index: 4,
      },
    ],
    brand: {
      path: '/superset/profile/admin/',
      icon: '/static/assets/images/superset-logo-horiz.png',
      alt: 'Superset',
      width: '126',
      tooltip: '',
      text: '',
    },
    navbar_right: {
      show_watermark: false,
      bug_report_url: '/report/',
      documentation_url: '/docs/',
      languages: {
        en: {
          flag: 'us',
          name: 'English',
          url: '/lang/en',
        },
        it: {
          flag: 'it',
          name: 'Italian',
          url: '/lang/it',
        },
      },
      show_language_picker: true,
      user_is_anonymous: true,
      user_info_url: '/users/userinfo/',
      user_logout_url: '/logout/',
      user_login_url: '/login/',
      user_profile_url: '/profile/',
      locale: 'en',
      version_string: '1.0.0',
      version_sha: 'randomSHA',
      build_number: 'randomBuildNumber',
    },
    settings: [
      {
        name: 'Security',
        icon: 'fa-cogs',
        label: 'Security',
        index: 1,
        childs: [
          {
            name: 'List Users',
            icon: 'fa-user',
            label: 'List Users',
            url: '/users/list/',
            index: 1,
          },
        ],
      },
    ],
  },
};

const notanonProps = {
  ...mockedProps,
  data: {
    ...mockedProps.data,
    navbar_right: {
      ...mockedProps.data.navbar_right,
      user_is_anonymous: false,
    },
  },
};

test('should render', () => {
  const { container } = render(<Menu {...mockedProps} />);
  expect(container).toBeInTheDocument();
});

test('should render the navigation', () => {
  render(<Menu {...mockedProps} />);
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

test('should render the brand', () => {
  const {
    data: {
      brand: { alt, icon },
    },
  } = mockedProps;
  render(<Menu {...mockedProps} />);
  const image = screen.getByAltText(alt);
  expect(image).toHaveAttribute('src', icon);
});

test('should render all the top navbar menu items', () => {
  const {
    data: { menu },
  } = mockedProps;
  render(<Menu {...mockedProps} />);
  menu.forEach(item => {
    expect(screen.getByText(item.label)).toBeInTheDocument();
  });
});

test('should render the top navbar child menu items', async () => {
  const {
    data: { menu },
  } = mockedProps;
  render(<Menu {...mockedProps} />);
  const sources = screen.getByText('Sources');
  userEvent.hover(sources);
  const datasets = await screen.findByText('Datasets');
  const databases = await screen.findByText('Databases');
  const dataset = menu[1].childs![0] as { url: string };
  const database = menu[1].childs![2] as { url: string };

  expect(datasets).toHaveAttribute('href', dataset.url);
  expect(databases).toHaveAttribute('href', database.url);
});

test('should render the dropdown items', async () => {
  render(<Menu {...notanonProps} />);
  const dropdown = screen.getByTestId('new-dropdown-icon');
  userEvent.hover(dropdown);
  expect(await screen.findByText(dropdownItems[0].label)).toHaveAttribute(
    'href',
    dropdownItems[0].url,
  );
  expect(
    screen.getByTestId(`menu-item-${dropdownItems[0].label}`),
  ).toBeInTheDocument();
  expect(await screen.findByText(dropdownItems[1].label)).toHaveAttribute(
    'href',
    dropdownItems[1].url,
  );
  expect(
    screen.getByTestId(`menu-item-${dropdownItems[1].label}`),
  ).toBeInTheDocument();
  expect(await screen.findByText(dropdownItems[2].label)).toHaveAttribute(
    'href',
    dropdownItems[2].url,
  );
  expect(
    screen.getByTestId(`menu-item-${dropdownItems[2].label}`),
  ).toBeInTheDocument();
});

test('should render the Settings', async () => {
  render(<Menu {...mockedProps} />);
  const settings = await screen.findByText('Settings');
  expect(settings).toBeInTheDocument();
});

test('should render the Settings menu item', async () => {
  render(<Menu {...mockedProps} />);
  userEvent.hover(screen.getByText('Settings'));
  const label = await screen.findByText('Security');
  expect(label).toBeInTheDocument();
});

test('should render the Settings dropdown child menu items', async () => {
  const {
    data: { settings },
  } = mockedProps;
  render(<Menu {...mockedProps} />);
  userEvent.hover(screen.getByText('Settings'));
  const listUsers = await screen.findByText('List Users');
  expect(listUsers).toHaveAttribute('href', settings[0].childs[0].url);
});

test('should render the plus menu (+) when user is not anonymous', () => {
  render(<Menu {...notanonProps} />);
  expect(screen.getByTestId('new-dropdown')).toBeInTheDocument();
});

test('should NOT render the plus menu (+) when user is anonymous', () => {
  render(<Menu {...mockedProps} />);
  expect(screen.queryByTestId('new-dropdown')).not.toBeInTheDocument();
});

test('should render the user actions when user is not anonymous', async () => {
  const {
    data: {
      navbar_right: { user_info_url, user_logout_url },
    },
  } = mockedProps;

  render(<Menu {...notanonProps} />);
  userEvent.hover(screen.getByText('Settings'));
  const user = await screen.findByText('User');
  expect(user).toBeInTheDocument();

  const info = await screen.findByText('Info');
  const logout = await screen.findByText('Logout');

  expect(info).toHaveAttribute('href', user_info_url);
  expect(logout).toHaveAttribute('href', user_logout_url);
});

test('should NOT render the user actions when user is anonymous', () => {
  render(<Menu {...mockedProps} />);
  expect(screen.queryByText('User')).not.toBeInTheDocument();
});

test('should render the Profile link when available', async () => {
  const {
    data: {
      navbar_right: { user_profile_url },
    },
  } = mockedProps;

  render(<Menu {...notanonProps} />);

  userEvent.hover(screen.getByText('Settings'));
  const profile = await screen.findByText('Profile');
  expect(profile).toHaveAttribute('href', user_profile_url);
});

test('should render the About section and version_string, sha or build_number when available', async () => {
  const {
    data: {
      navbar_right: { version_sha, version_string, build_number },
    },
  } = mockedProps;

  render(<Menu {...mockedProps} />);
  userEvent.hover(screen.getByText('Settings'));
  const about = await screen.findByText('About');
  const version = await screen.findByText(`Version: ${version_string}`);
  const sha = await screen.findByText(`SHA: ${version_sha}`);
  const build = await screen.findByText(`Build: ${build_number}`);
  expect(about).toBeInTheDocument();
  expect(version).toBeInTheDocument();
  expect(sha).toBeInTheDocument();
  expect(build).toBeInTheDocument();
});

test('should render the Documentation link when available', async () => {
  const {
    data: {
      navbar_right: { documentation_url },
    },
  } = mockedProps;
  render(<Menu {...mockedProps} />);
  userEvent.hover(screen.getByText('Settings'));
  const doc = await screen.findByTitle('Documentation');
  expect(doc).toHaveAttribute('href', documentation_url);
});

test('should render the Bug Report link when available', async () => {
  const {
    data: {
      navbar_right: { bug_report_url },
    },
  } = mockedProps;

  render(<Menu {...mockedProps} />);
  const bugReport = await screen.findByTitle('Report a bug');
  expect(bugReport).toHaveAttribute('href', bug_report_url);
});

test('should render the Login link when user is anonymous', () => {
  const {
    data: {
      navbar_right: { user_login_url },
    },
  } = mockedProps;

  render(<Menu {...mockedProps} />);
  const login = screen.getByText('Login');
  expect(login).toHaveAttribute('href', user_login_url);
});

test('should render the Language Picker', () => {
  render(<Menu {...mockedProps} />);
  expect(screen.getByLabelText('Languages')).toBeInTheDocument();
});
