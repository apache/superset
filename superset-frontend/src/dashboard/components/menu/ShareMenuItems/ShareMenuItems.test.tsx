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
import { Menu } from 'src/common/components';
import { render, screen, waitFor } from 'spec/helpers/testing-library';
import userEvent from '@testing-library/user-event';
import * as copyTextToClipboard from 'src/utils/copy';
import fetchMock from 'fetch-mock';
import ShareMenuItems from '.';

const spy = jest.spyOn(copyTextToClipboard, 'default');

const createProps = () => ({
  addDangerToast: jest.fn(),
  addSuccessToast: jest.fn(),
  url: '/superset/dashboard/26/?preselect_filters=%7B%7D',
  copyMenuItemTitle: 'Copy dashboard URL',
  emailMenuItemTitle: 'Share dashboard by email',
  emailSubject: 'Superset dashboard COVID Vaccine Dashboard',
  emailBody: 'Check out this dashboard: ',
});

const { location } = window;

beforeAll((): void => {
  // @ts-ignore
  delete window.location;
  fetchMock.post(
    'http://localhost/r/shortner/',
    { body: 'http://localhost:8088/r/3' },
    {
      sendAsJson: false,
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
    <Menu onClick={jest.fn()} selectable={false} data-test="main-menu">
      <ShareMenuItems {...props} />
    </Menu>,
  );
  expect(
    screen.getByRole('menuitem', { name: 'Copy dashboard URL' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('menuitem', { name: 'Share dashboard by email' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Copy dashboard URL' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Share dashboard by email' }),
  ).toBeInTheDocument();
});

test('Click on "Copy dashboard URL" and succeed', async () => {
  spy.mockResolvedValue(undefined);
  const props = createProps();
  render(
    <Menu onClick={jest.fn()} selectable={false} data-test="main-menu">
      <ShareMenuItems {...props} />
    </Menu>,
  );

  await waitFor(() => {
    expect(spy).toBeCalledTimes(0);
    expect(props.addSuccessToast).toBeCalledTimes(0);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Copy dashboard URL' }));

  await waitFor(() => {
    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith('http://localhost:8088/r/3');
    expect(props.addSuccessToast).toBeCalledTimes(1);
    expect(props.addSuccessToast).toBeCalledWith('Copied to clipboard!');
    expect(props.addDangerToast).toBeCalledTimes(0);
  });
});

test('Click on "Copy dashboard URL" and fail', async () => {
  spy.mockRejectedValue(undefined);
  const props = createProps();
  render(
    <Menu onClick={jest.fn()} selectable={false} data-test="main-menu">
      <ShareMenuItems {...props} />
    </Menu>,
  );

  await waitFor(() => {
    expect(spy).toBeCalledTimes(0);
    expect(props.addSuccessToast).toBeCalledTimes(0);
    expect(props.addDangerToast).toBeCalledTimes(0);
  });

  userEvent.click(screen.getByRole('button', { name: 'Copy dashboard URL' }));

  await waitFor(() => {
    expect(spy).toBeCalledTimes(1);
    expect(spy).toBeCalledWith('http://localhost:8088/r/3');
    expect(props.addSuccessToast).toBeCalledTimes(0);
    expect(props.addDangerToast).toBeCalledTimes(1);
    expect(props.addDangerToast).toBeCalledWith(
      'Sorry, your browser does not support copying.',
    );
  });
});

test('Click on "Share dashboard by email" and succeed', async () => {
  const props = createProps();
  render(
    <Menu onClick={jest.fn()} selectable={false} data-test="main-menu">
      <ShareMenuItems {...props} />
    </Menu>,
  );

  await waitFor(() => {
    expect(props.addDangerToast).toBeCalledTimes(0);
    expect(window.location.href).toBe('');
  });

  userEvent.click(
    screen.getByRole('button', { name: 'Share dashboard by email' }),
  );

  await waitFor(() => {
    expect(props.addDangerToast).toBeCalledTimes(0);
    expect(window.location.href).toBe(
      'mailto:?Subject=Superset dashboard COVID Vaccine Dashboard%20&Body=Check out this dashboard: http://localhost:8088/r/3',
    );
  });
});

test('Click on "Share dashboard by email" and fail', async () => {
  fetchMock.post(
    'http://localhost/r/shortner/',
    { status: 404 },
    { overwriteRoutes: true },
  );
  const props = createProps();
  render(
    <Menu onClick={jest.fn()} selectable={false} data-test="main-menu">
      <ShareMenuItems {...props} />
    </Menu>,
  );

  await waitFor(() => {
    expect(props.addDangerToast).toBeCalledTimes(0);
    expect(window.location.href).toBe('');
  });

  userEvent.click(
    screen.getByRole('button', { name: 'Share dashboard by email' }),
  );

  await waitFor(() => {
    expect(window.location.href).toBe('');
    expect(props.addDangerToast).toBeCalledTimes(1);
    expect(props.addDangerToast).toBeCalledWith(
      'Sorry, something went wrong. Try again later.',
    );
  });
});
