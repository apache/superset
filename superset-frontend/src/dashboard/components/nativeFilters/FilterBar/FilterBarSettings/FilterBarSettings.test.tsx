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
import { waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { render, screen, within } from 'spec/helpers/testing-library';
import { DashboardInfo, FilterBarOrientation } from 'src/dashboard/types';
import * as mockedMessageActions from 'src/components/MessageToasts/actions';
import FilterBarSettings from '.';

const initialState: { dashboardInfo: DashboardInfo } = {
  dashboardInfo: {
    id: 1,
    userId: '1',
    metadata: {
      native_filter_configuration: [{}],
      chart_configuration: {},
      global_chart_configuration: {
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        chartsInScope: [],
      },
      color_scheme: '',
      color_namespace: '',
      color_scheme_domain: [],
      label_colors: {},
      shared_label_colors: [],
      map_label_colors: {},
      cross_filters_enabled: false,
    },
    json_metadata: '',
    dash_edit_perm: true,
    filterBarOrientation: FilterBarOrientation.Vertical,
    common: {
      conf: {},
    },
    crossFiltersEnabled: true,
    created_on_delta_humanized: '',
    changed_on_delta_humanized: '',
    owners: [],
  },
};

const setup = (dashboardInfoOverride: Partial<DashboardInfo> = {}) =>
  waitFor(() =>
    render(<FilterBarSettings />, {
      useRedux: true,
      initialState: {
        ...initialState,
        dashboardInfo: {
          ...initialState.dashboardInfo,
          ...dashboardInfoOverride,
        },
      },
    }),
  );

beforeEach(() => {
  fetchMock.restore();
});

test('Dropdown trigger renders', async () => {
  await setup();
  expect(screen.getByLabelText('gear')).toBeVisible();
});

test('Dropdown trigger renders with dashboard edit permissions', async () => {
  await setup({
    dash_edit_perm: true,
  });
  expect(screen.getByRole('img', { name: 'gear' })).toBeInTheDocument();
});

test('Dropdown trigger does not render without dashboard edit permissions', async () => {
  await setup({
    dash_edit_perm: false,
  });

  expect(screen.queryByRole('img', { name: 'gear' })).not.toBeInTheDocument();
});

test('Popover shows cross-filtering option on by default', async () => {
  await setup();
  userEvent.click(screen.getByLabelText('gear'));
  expect(screen.getByText('Enable cross-filtering')).toBeInTheDocument();
  expect(screen.getByRole('checkbox')).toBeChecked();
});

test('Can enable/disable cross-filtering', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1', {
    result: {},
  });
  await setup();
  userEvent.click(screen.getByLabelText('gear'));
  const initialCheckbox = screen.getByRole('checkbox');
  expect(initialCheckbox).toBeChecked();

  userEvent.click(initialCheckbox);

  userEvent.click(screen.getByLabelText('gear'));
  expect(screen.getByRole('checkbox')).not.toBeChecked();
});

test('Popover opens with "Vertical" selected', async () => {
  await setup();
  userEvent.click(screen.getByLabelText('gear'));
  userEvent.hover(screen.getByText('Orientation of filter bar'));
  expect(await screen.findByText('Vertical (Left)')).toBeInTheDocument();
  expect(screen.getByText('Horizontal (Top)')).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[4]).getByLabelText('check'),
  ).toBeInTheDocument();
});

test('Popover opens with "Horizontal" selected', async () => {
  await setup({ filterBarOrientation: FilterBarOrientation.Horizontal });
  userEvent.click(screen.getByLabelText('gear'));
  userEvent.hover(screen.getByText('Orientation of filter bar'));
  expect(await screen.findByText('Vertical (Left)')).toBeInTheDocument();
  expect(screen.getByText('Horizontal (Top)')).toBeInTheDocument();
  expect(
    within(screen.getAllByRole('menuitem')[5]).getByLabelText('check'),
  ).toBeInTheDocument();
});

test('On selection change, send request and update checked value', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1', {
    result: {
      json_metadata: JSON.stringify({
        ...initialState.dashboardInfo.metadata,
        filter_bar_orientation: 'HORIZONTAL',
      }),
    },
  });

  await setup();
  userEvent.click(screen.getByLabelText('gear'));
  userEvent.hover(screen.getByText('Orientation of filter bar'));

  const verticalItem = await screen.findByText('Vertical (Left)');
  expect(
    within(verticalItem.closest('li')!).getByLabelText('check'),
  ).toBeInTheDocument();

  userEvent.click(screen.getByText('Horizontal (Top)'));

  userEvent.click(screen.getByLabelText('gear'));
  userEvent.hover(screen.getByText('Orientation of filter bar'));

  const horizontalItem = await screen.findByText('Horizontal (Top)');
  expect(
    within(horizontalItem.closest('li')!).getByLabelText('check'),
  ).toBeInTheDocument();

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

  await waitFor(() => {
    userEvent.click(screen.getByLabelText('gear'));
    userEvent.hover(screen.getByText('Orientation of filter bar'));
    const updatedHorizontalItem = screen.getByText('Horizontal (Top)');
    expect(
      within(updatedHorizontalItem.closest('li')!).getByLabelText('check'),
    ).toBeInTheDocument();
    expect(
      within(verticalItem.closest('li')!).queryByLabelText('check'),
    ).not.toBeInTheDocument();
  });
});

test('On failed request, restore previous selection', async () => {
  fetchMock.put('glob:*/api/v1/dashboard/1', 400);

  const dangerToastSpy = jest.spyOn(mockedMessageActions, 'addDangerToast');

  await setup();
  const gearIcon = await screen.findByLabelText('gear');
  userEvent.click(gearIcon);

  const orientationMenu = await screen.findByText('Orientation of filter bar');
  userEvent.hover(orientationMenu);

  // Wait for menu items to be visible
  const verticalItem = await screen.findByText('Vertical (Left)');
  const horizontalItem = await screen.findByText('Horizontal (Top)');

  // Verify initial state
  expect(
    within(verticalItem.closest('li')!).getByLabelText('check'),
  ).toBeInTheDocument();
  expect(
    within(horizontalItem.closest('li')!).queryByLabelText('check'),
  ).not.toBeInTheDocument();

  // Click horizontal option
  userEvent.click(horizontalItem);

  // Verify error toast
  await waitFor(() => {
    expect(dangerToastSpy).toHaveBeenCalledWith(
      'Sorry, there was an error saving this dashboard: Unknown Error',
    );
  });

  // Reopen menu and verify selection rolled back
  userEvent.click(gearIcon);
  userEvent.hover(orientationMenu);

  // Wait for menu items and verify state
  await waitFor(() => {
    const verticalItemAfter = screen.getByText('Vertical (Left)');
    const horizontalItemAfter = screen.getByText('Horizontal (Top)');
    expect(
      within(verticalItemAfter.closest('li')!).getByLabelText('check'),
    ).toBeInTheDocument();
    expect(
      within(horizontalItemAfter.closest('li')!).queryByLabelText('check'),
    ).not.toBeInTheDocument();
  });
});
