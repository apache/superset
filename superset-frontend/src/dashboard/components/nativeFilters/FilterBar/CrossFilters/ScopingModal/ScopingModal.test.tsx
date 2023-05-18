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
import userEvent from '@testing-library/user-event';
import { render, screen, waitFor, within } from 'spec/helpers/testing-library';
import {
  CHART_TYPE,
  DASHBOARD_ROOT_TYPE,
} from 'src/dashboard/util/componentTypes';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { ScopingModal, ScopingModalProps } from './ScopingModal';

const INITIAL_STATE = {
  charts: {
    1: { id: 1 },
    2: { id: 2 },
    3: { id: 3 },
    4: { id: 4 },
  },
  dashboardInfo: {
    id: 1,
    metadata: {
      chart_configuration: {
        1: {
          id: 1,
          crossFilters: {
            scope: 'global' as const,
            chartsInScope: [2, 3, 4],
          },
        },
        2: {
          id: 2,
          crossFilters: {
            scope: 'global' as const,
            chartsInScope: [1, 3, 4],
          },
        },
        3: {
          id: 3,
          crossFilters: {
            scope: {
              rootPath: ['ROOT_ID'],
              excluded: [1, 3],
            },
            chartsInScope: [2, 4],
          },
        },
        4: {
          id: 4,
          crossFilters: {
            scope: {
              rootPath: ['ROOT_ID'],
              excluded: [1, 4],
            },
            chartsInScope: [2, 3],
          },
        },
      },
      global_chart_configuration: {
        scope: { rootPath: ['ROOT_ID'], excluded: [] },
        chartsInScope: [1, 2, 3, 4],
      },
    },
  },
  dashboardLayout: {
    past: [],
    future: [],
    present: {
      [DASHBOARD_ROOT_ID]: {
        type: DASHBOARD_ROOT_TYPE,
        id: DASHBOARD_ROOT_ID,
        children: ['CHART_1', 'CHART_2', 'CHART_3', 'CHART_4'],
      },
      CHART_1: {
        id: 'CHART_1',
        type: CHART_TYPE,
        meta: {
          chartId: 1,
          sliceName: 'chart 1',
        },
        parents: ['ROOT_ID'],
      },
      CHART_2: {
        id: 'CHART_2',
        type: CHART_TYPE,
        meta: {
          chartId: 2,
          sliceName: 'chart 2',
        },
        parents: ['ROOT_ID'],
      },
      CHART_3: {
        id: 'CHART_3',
        type: CHART_TYPE,
        meta: {
          chartId: 3,
          sliceName: 'chart 3',
          sliceNameOverride: 'Chart 3',
        },
        parents: ['ROOT_ID'],
      },
      CHART_4: {
        id: 'CHART_4',
        type: CHART_TYPE,
        meta: {
          chartId: 4,
          sliceName: 'chart 4',
        },
        parents: ['ROOT_ID'],
      },
    },
  },
};

const DEFAULT_PROPS: ScopingModalProps = {
  closeModal: jest.fn(),
  initialChartId: undefined,
  isVisible: true,
};

const setup = (props = DEFAULT_PROPS) =>
  render(<ScopingModal {...props} />, {
    useRedux: true,
    initialState: INITIAL_STATE,
  });

const DASHBOARD_UPDATE_URL = 'glob:*api/v1/dashboard/1';
beforeEach(() => {
  fetchMock.put(DASHBOARD_UPDATE_URL, 200);
});

afterEach(() => {
  fetchMock.restore();
});

it('renders modal', () => {
  setup();
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByTestId('scoping-tree-panel')).toBeInTheDocument();
  expect(screen.getByTestId('scoping-list-panel')).toBeInTheDocument();
});

it('switch currently edited chart scoping', async () => {
  setup();
  const withinScopingList = within(screen.getByTestId('scoping-list-panel'));
  expect(withinScopingList.getByText('All charts/global scoping')).toHaveClass(
    'active',
  );
  userEvent.click(withinScopingList.getByText('Chart 3'));
  await waitFor(() => {
    expect(withinScopingList.getByText('Chart 3')).toHaveClass('active');
    expect(
      withinScopingList.getByText('All charts/global scoping'),
    ).not.toHaveClass('active');
  });
});

it('scoping tree global and custom checks', () => {
  setup();

  expect(
    document.querySelectorAll(
      '[data-test="scoping-tree-panel"] .ant-tree-checkbox-checked',
    ),
  ).toHaveLength(5);

  userEvent.click(
    within(screen.getByTestId('scoping-list-panel')).getByText('Chart 3'),
  );

  expect(
    document.querySelectorAll(
      '[data-test="scoping-tree-panel"] .ant-tree-checkbox-checked',
    ),
  ).toHaveLength(2);
});

it('add new custom scoping', async () => {
  setup();

  userEvent.click(screen.getByText('Add custom scoping'));

  expect(screen.getByText('[new custom scoping]')).toBeInTheDocument();
  expect(screen.getByText('[new custom scoping]')).toHaveClass('active');

  await waitFor(() =>
    userEvent.click(screen.getByRole('combobox', { name: 'Select chart' })),
  );
  await waitFor(() => {
    userEvent.click(
      within(document.querySelector('.rc-virtual-list')!).getByText('chart 1'),
    );
  });

  expect(
    within(document.querySelector('.ant-select-selection-item')!).getByText(
      'chart 1',
    ),
  ).toBeInTheDocument();

  expect(
    document.querySelectorAll(
      '[data-test="scoping-tree-panel"] .ant-tree-checkbox-checked',
    ),
  ).toHaveLength(4);

  userEvent.click(
    within(document.querySelector('.ant-tree')!).getByText('chart 2'),
  );

  expect(
    document.querySelectorAll(
      '[data-test="scoping-tree-panel"] .ant-tree-checkbox-checked',
    ),
  ).toHaveLength(2);
});

it('edit scope and save', async () => {
  setup();

  // unselect chart 2 in global scoping
  userEvent.click(
    within(document.querySelector('.ant-tree')!).getByText('chart 2'),
  );

  userEvent.click(
    within(screen.getByTestId('scoping-list-panel')).getByText('Chart 3'),
  );

  // select chart 1 in chart 3's custom scoping
  userEvent.click(
    within(document.querySelector('.ant-tree')!).getByText('chart 1'),
  );

  // create custom scoping for chart 1 with unselected chart 2 (from global) and chart 4
  userEvent.click(screen.getByText('Add custom scoping'));
  await waitFor(() =>
    userEvent.click(screen.getByRole('combobox', { name: 'Select chart' })),
  );
  await waitFor(() => {
    userEvent.click(
      within(document.querySelector('.rc-virtual-list')!).getByText('chart 1'),
    );
  });
  userEvent.click(
    within(document.querySelector('.ant-tree')!).getByText('chart 4'),
  );

  // remove custom scoping for chart 4
  userEvent.click(
    within(
      within(screen.getByTestId('scoping-list-panel'))
        .getByText('chart 4')
        .closest('div')!,
    ).getByLabelText('trash'),
  );
  expect(
    within(screen.getByTestId('scoping-list-panel')).queryByText('chart 4'),
  ).not.toBeInTheDocument();

  userEvent.click(screen.getByText('Save'));

  await waitFor(() => fetchMock.called(DASHBOARD_UPDATE_URL));

  expect(
    JSON.parse(
      JSON.parse(fetchMock.lastCall()?.[1]?.body as string).json_metadata,
    ),
  ).toEqual({
    chart_configuration: {
      '1': {
        id: 1,
        crossFilters: {
          scope: { rootPath: ['ROOT_ID'], excluded: [1, 2, 4] },
          chartsInScope: [3],
        },
      },
      '2': {
        id: 2,
        crossFilters: {
          scope: 'global',
          chartsInScope: [1, 3, 4],
        },
      },
      '3': {
        id: 3,
        crossFilters: {
          scope: { rootPath: ['ROOT_ID'], excluded: [3] },
          chartsInScope: [1, 2, 4],
        },
      },
      '4': {
        id: 4,
        crossFilters: {
          scope: 'global',
          chartsInScope: [1, 3],
        },
      },
    },
    global_chart_configuration: {
      scope: { rootPath: ['ROOT_ID'], excluded: [2] },
      chartsInScope: [1, 3, 4],
    },
  });
});
