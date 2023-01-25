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
import fetchMock from 'fetch-mock';
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'spec/helpers/testing-library';
import { DashboardInfo, FilterBarOrientation } from 'src/dashboard/types';
import * as mockedMessageActions from 'src/components/MessageToasts/actions';
import FilterBarOrientationSelect from '.';

const initialState: { dashboardInfo: DashboardInfo } = {
  dashboardInfo: {
    id: 1,
    userId: '1',
    metadata: {
      native_filter_configuration: {},
      show_native_filters: true,
      chart_configuration: {},
      color_scheme: '',
      color_namespace: '',
      color_scheme_domain: [],
      label_colors: {},
      shared_label_colors: {},
    },
    json_metadata: '',
    dash_edit_perm: true,
    filterBarOrientation: FilterBarOrientation.VERTICAL,
    common: {
      conf: {},
      flash_messages: [],
    },
  },
};

const setup = (dashboardInfoOverride: Partial<DashboardInfo> = {}) =>
  render(<FilterBarOrientationSelect />, {
    useRedux: true,
    initialState: {
      ...initialState,
      dashboardInfo: {
        ...initialState.dashboardInfo,
        ...dashboardInfoOverride,
      },
    },
  });

test('Dropdown trigger renders', () => {
  setup();
  expect(screen.getByLabelText('gear')).toBeVisible();
});

test('Popover opens with "Vertical" selected', async () => {
  setup();
  userEvent.click(screen.getByLabelText('gear'));
  expect(await screen.findByText('Vertical (Left)')).toBeInTheDocument();
  expect(screen.getByText('Horizontal (Top)')).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[0]).getByLabelText('check'),
  ).toBeInTheDocument();
});

test('Popover opens with "Horizontal" selected', async () => {
  setup({ filterBarOrientation: FilterBarOrientation.HORIZONTAL });
  userEvent.click(screen.getByLabelText('gear'));
  expect(await screen.findByText('Vertical (Left)')).toBeInTheDocument();
  expect(screen.getByText('Horizontal (Top)')).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[1]).getByLabelText('check'),
  ).toBeInTheDocument();
});

test('On selection change, send request and update checked value', async () => {
  fetchMock.reset();
  fetchMock.put('glob:*/api/v1/dashboard/1', {
    result: {
      json_metadata: JSON.stringify({
        ...initialState.dashboardInfo.metadata,
        filter_bar_orientation: 'HORIZONTAL',
      }),
    },
  });

  setup();
  userEvent.click(screen.getByLabelText('gear'));

  expect(
    within(screen.getAllByRole('menuitem')[0]).getByLabelText('check'),
  ).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[1]).queryByLabelText('check'),
  ).not.toBeInTheDocument();

  userEvent.click(await screen.findByText('Horizontal (Top)'));

  // 1st check - checkmark appears immediately after click
  expect(
    await within(screen.getAllByRole('menuitem')[1]).findByLabelText('check'),
  ).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[0]).queryByLabelText('check'),
  ).not.toBeInTheDocument();

  // successful query
  await waitFor(() =>
    expect(fetchMock.lastCall()?.[1]?.body).toEqual(
      JSON.stringify({
        json_metadata: JSON.stringify({
          ...initialState.dashboardInfo.metadata,
          filter_bar_orientation: 'HORIZONTAL',
        }),
      }),
    ),
  );

  // 2nd check - checkmark stays after successful query
  expect(
    await within(screen.getAllByRole('menuitem')[1]).findByLabelText('check'),
  ).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[0]).queryByLabelText('check'),
  ).not.toBeInTheDocument();

  fetchMock.reset();
});

test('On failed request, restore previous selection', async () => {
  fetchMock.reset();
  fetchMock.put('glob:*/api/v1/dashboard/1', 400);

  const dangerToastSpy = jest.spyOn(mockedMessageActions, 'addDangerToast');

  setup();
  userEvent.click(screen.getByLabelText('gear'));

  expect(
    within(screen.getAllByRole('menuitem')[0]).getByLabelText('check'),
  ).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[1]).queryByLabelText('check'),
  ).not.toBeInTheDocument();

  userEvent.click(await screen.findByText('Horizontal (Top)'));

  // checkmark gets rolled back to the original selection after successful query
  expect(
    await within(screen.getAllByRole('menuitem')[0]).findByLabelText('check'),
  ).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[1]).queryByLabelText('check'),
  ).not.toBeInTheDocument();

  expect(dangerToastSpy).toHaveBeenCalledWith(
    'Sorry, there was an error saving this dashboard: Unknown Error',
  );

  fetchMock.reset();
});
