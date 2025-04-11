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

import { Menu } from 'src/components/Menu';
import {
  render,
  screen,
  userEvent,
  waitFor,
} from 'spec/helpers/testing-library';
import * as copyTextToClipboard from 'src/utils/copy';
import fetchMock from 'fetch-mock';
import ShareMenuItems from '.';

const spy = jest.spyOn(copyTextToClipboard, 'default');

const DASHBOARD_ID = '26';
const createProps = () => ({
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  url: `/superset/dashboard/${DASHBOARD_ID}`,
  copyMenuItemTitle: 'Copy dashboard URL',
  emailMenuItemTitle: 'Share dashboard by email',
  emailSubject: 'Superset dashboard COVID Vaccine Dashboard',
  emailBody: 'Check out this dashboard: ',
  dashboardId: DASHBOARD_ID,
  title: 'Test Dashboard',
  submenuKey: 'share',
});

const { location } = window;

beforeAll((): void => {
  // @ts-ignore
  delete window.location;
  fetchMock.post(
    `http://localhost/api/v1/dashboard/${DASHBOARD_ID}/permalink`,
    { key: '123', url: 'http://localhost/superset/dashboard/p/123/' },
    {
      sendAsJson: true,
    },
  );
});

beforeEach(() => {
  jest.clearAllMocks();
  window.location = {
    href: '',
  } as any;
});

afterAll((): void => {
  window.location = location;
});

test('Should render menu items', () => {
  const props = createProps();
  render(
    <Menu
      onClick={jest.fn()}
      selectable={false}
      data-test="main-menu"
      forceSubMenuRender
    >
      <ShareMenuItems {...props} />
    </Menu>,
    { useRedux: true },
  );
  expect(screen.getByText('Copy dashboard URL')).toBeInTheDocument();
  expect(screen.getByText('Share dashboard by email')).toBeInTheDocument();
});

test('Click on "Copy dashboard URL" and succeed', async () => {
  spy.mockResolvedValue(undefined);
  const props = createProps();
  render(
    <Menu
      onClick={jest.fn()}
      selectable={false}
      data-test="main-menu"
      forceSubMenuRender
    >
      <ShareMenuItems {...props} />
    </Menu>,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(spy).toHaveBeenCalledTimes(0);
    expect(props.addSuccessToast).toHaveBeenCalledTimes(0);
    expect(props.addDangerToast).toHaveBeenCalledTimes(0);
  });

  userEvent.click(screen.getByText('Copy dashboard URL'));

  await waitFor(async () => {
    expect(spy).toHaveBeenCalledTimes(1);
    const value = await spy.mock.calls[0][0]();
    expect(value).toBe('http://localhost/superset/dashboard/p/123/');
    expect(props.addSuccessToast).toHaveBeenCalledTimes(1);
    expect(props.addSuccessToast).toHaveBeenCalledWith('Copied to clipboard!');
    expect(props.addDangerToast).toHaveBeenCalledTimes(0);
  });
});

test('Click on "Copy dashboard URL" and fail', async () => {
  spy.mockRejectedValue(undefined);
  const props = createProps();
  render(
    <Menu
      onClick={jest.fn()}
      selectable={false}
      data-test="main-menu"
      forceSubMenuRender
    >
      <ShareMenuItems {...props} />
    </Menu>,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(spy).toHaveBeenCalledTimes(0);
    expect(props.addSuccessToast).toHaveBeenCalledTimes(0);
    expect(props.addDangerToast).toHaveBeenCalledTimes(0);
  });

  userEvent.click(screen.getByText('Copy dashboard URL'));

  await waitFor(async () => {
    expect(spy).toHaveBeenCalledTimes(1);
    const value = await spy.mock.calls[0][0]();
    expect(value).toBe('http://localhost/superset/dashboard/p/123/');
    expect(props.addSuccessToast).toHaveBeenCalledTimes(0);
    expect(props.addDangerToast).toHaveBeenCalledTimes(1);
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
});

test('Click on "Share dashboard by email" and succeed', async () => {
  const props = createProps();
  render(
    <Menu
      onClick={jest.fn()}
      selectable={false}
      data-test="main-menu"
      forceSubMenuRender
    >
      <ShareMenuItems {...props} />
    </Menu>,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledTimes(0);
    expect(window.location.href).toBe('');
  });

  userEvent.click(screen.getByText('Share dashboard by email'));

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledTimes(0);
    expect(window.location.href).toBe(
      'mailto:?Subject=Superset%20dashboard%20COVID%20Vaccine%20Dashboard%20&Body=Check%20out%20this%20dashboard%3A%20http%3A%2F%2Flocalhost%2Fsuperset%2Fdashboard%2Fp%2F123%2F',
    );
  });
});

test('Click on "Share dashboard by email" and fail', async () => {
  fetchMock.post(
    `http://localhost/api/v1/dashboard/${DASHBOARD_ID}/permalink`,
    { status: 404 },
    { overwriteRoutes: true },
  );
  const props = createProps();
  render(
    <Menu
      onClick={jest.fn()}
      selectable={false}
      data-test="main-menu"
      forceSubMenuRender
    >
      <ShareMenuItems {...props} />
    </Menu>,
    { useRedux: true },
  );

  await waitFor(() => {
    expect(props.addDangerToast).toHaveBeenCalledTimes(0);
    expect(window.location.href).toBe('');
  });

  userEvent.click(screen.getByText('Share dashboard by email'));

  await waitFor(() => {
    expect(window.location.href).toBe('');
    expect(props.addDangerToast).toHaveBeenCalledTimes(1);
    expect(props.addDangerToast).toHaveBeenCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
});
