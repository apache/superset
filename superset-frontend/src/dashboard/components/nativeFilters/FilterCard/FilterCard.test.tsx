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
import { Filter, NativeFilterType } from '@superset-ui/core';
import userEvent from '@testing-library/user-event';
import { render, screen } from 'spec/helpers/testing-library';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import { SET_DIRECT_PATH } from 'src/dashboard/actions/dashboardState';
import { FilterCardContent } from './FilterCardContent';

const baseInitialState = {
  dashboardInfo: {},
  nativeFilters: {
    filters: {
      'NATIVE_FILTER-1': {
        id: 'NATIVE_FILTER-1',
        controlValues: {},
        name: 'Native filter 1',
        filterType: 'filter_select',
        targets: [
          {
            datasetId: 1,
            column: {
              name: 'gender',
            },
          },
        ],
        defaultDataMask: {},
        cascadeParentIds: [],
        scope: {
          rootPath: [DASHBOARD_ROOT_ID],
          excluded: [],
        },
        type: NativeFilterType.NativeFilter,
        description: '',
      },
      'NATIVE_FILTER-2': {
        id: 'NATIVE_FILTER-2',
        controlValues: {},
        name: 'Native filter 2',
        filterType: 'filter_select',
        targets: [
          {
            datasetId: 1,
            column: {
              name: 'gender',
            },
          },
        ],
        defaultDataMask: {},
        cascadeParentIds: [],
        scope: {
          rootPath: [DASHBOARD_ROOT_ID],
          excluded: [],
        },
        type: NativeFilterType.NativeFilter,
        description: '',
      },
    },
  },
  charts: {
    '1': {
      id: 1,
    },
    '2': {
      id: 2,
    },
    '3': {
      id: 3,
    },
  },
  dashboardLayout: {
    past: [],
    future: [],
    present: {
      ROOT_ID: {
        children: ['TABS-1'],
        id: 'ROOT_ID',
        type: 'ROOT',
      },

      'TABS-1': {
        children: ['TAB-1', 'TAB-2'],
        id: 'TABS-1',
        meta: {},
        parents: ['ROOT_ID'],
        type: 'TABS',
      },
      'TAB-1': {
        children: [],
        id: 'TAB-1',
        meta: {
          defaultText: 'Tab title',
          placeholder: 'Tab title',
          text: 'Tab 1',
        },
        parents: ['ROOT_ID', 'TABS-1'],
        type: 'TAB',
      },
      'TAB-2': {
        children: [],
        id: 'TAB-2',
        meta: {
          defaultText: 'Tab title',
          placeholder: 'Tab title',
          text: 'Tab 2',
        },
        parents: ['ROOT_ID', 'TABS-1'],
        type: 'TAB',
      },
      'CHART-1': {
        children: [],
        id: 'CHART-1',
        meta: {
          chartId: 1,
          sliceName: 'Test chart',
        },
        parents: ['ROOT_ID', 'TABS-1', 'TAB-1'],
        type: 'CHART',
      },
      'CHART-2': {
        children: [],
        id: 'CHART-2',
        meta: {
          chartId: 2,
          sliceName: 'Test chart 2',
        },
        parents: ['ROOT_ID', 'TABS-1', 'TAB-1'],
        type: 'CHART',
      },
      'CHART-3': {
        children: [],
        id: 'CHART-3',
        meta: {
          chartId: 3,
          sliceName: 'Test chart 3',
        },
        parents: ['ROOT_ID', 'TABS-1', 'TAB-1'],
        type: 'CHART',
      },
      'CHART-4': {
        children: [],
        id: 'CHART-4',
        meta: {
          chartId: 4,
          sliceName: 'Test chart 4',
        },
        parents: ['ROOT_ID', 'TABS-1', 'TAB-2'],
        type: 'CHART',
      },
    },
  },
};
const baseFilter: Filter = {
  id: 'NATIVE_FILTER-1',
  controlValues: {},
  name: 'Native filter 1',
  filterType: 'filter_select',
  targets: [
    {
      datasetId: 1,
      column: {
        name: 'gender',
      },
    },
  ],
  defaultDataMask: {},
  cascadeParentIds: [],
  scope: {
    rootPath: [DASHBOARD_ROOT_ID],
    excluded: [],
  },
  type: NativeFilterType.NativeFilter,
  description: '',
};

jest.mock('@superset-ui/core', () => ({
  // @ts-ignore
  ...jest.requireActual('@superset-ui/core'),
  getChartMetadataRegistry: () => ({
    get: (type: string) => {
      if (type === 'filter_select') {
        return { name: 'Select filter' };
      }
      return undefined;
    },
  }),
}));

// extract text from embedded html tags
// source: https://polvara.me/posts/five-things-you-didnt-know-about-testing-library
const getTextInHTMLTags =
  (target: string | RegExp) => (content: string, node: Element) => {
    const hasText = (node: Element) => node.textContent === target;
    const nodeHasText = hasText(node);
    const childrenDontHaveText = Array.from(node.children).every(
      child => !hasText(child),
    );

    return nodeHasText && childrenDontHaveText;
  };

const hidePopover = jest.fn();

const renderContent = (filter = baseFilter, initialState = baseInitialState) =>
  render(<FilterCardContent filter={filter} hidePopover={hidePopover} />, {
    useRedux: true,
    initialState,
  });

test('filter card title, type, scope, dependencies', () => {
  renderContent();
  expect(screen.getByText('Native filter 1')).toBeVisible();
  expect(screen.getByLabelText('filter-small')).toBeVisible();

  expect(screen.getByText('Filter type')).toBeVisible();
  expect(screen.getByText('Select filter')).toBeVisible();

  expect(screen.getByText('Scope')).toBeVisible();
  expect(screen.getByText('All charts')).toBeVisible();

  expect(screen.queryByText('Dependencies')).not.toBeInTheDocument();
});

test('filter card scope with excluded', () => {
  const filter = {
    ...baseFilter,
    scope: { rootPath: [DASHBOARD_ROOT_ID], excluded: [1, 4] },
  };
  renderContent(filter);
  expect(screen.getByText('Scope')).toBeVisible();
  expect(
    screen.getByText(getTextInHTMLTags('Test chart 2, Test chart 3')),
  ).toBeVisible();
});

test('filter card scope with top level tab as root', () => {
  const filter = {
    ...baseFilter,
    scope: { rootPath: ['TAB-1', 'TAB-2'], excluded: [1, 2] },
  };
  renderContent(filter);
  expect(screen.getByText('Scope')).toBeVisible();
  expect(
    screen.getByText(getTextInHTMLTags('Tab 2, Test chart 3')),
  ).toBeVisible();
});

test('filter card empty scope', () => {
  const filter = {
    ...baseFilter,
    scope: { rootPath: [], excluded: [1, 2, 3, 4] },
  };
  renderContent(filter);
  expect(screen.getByText('Scope')).toBeVisible();
  expect(screen.getByText('None')).toBeVisible();
});

test('filter card with dependency', () => {
  const filter = {
    ...baseFilter,
    cascadeParentIds: ['NATIVE_FILTER-2'],
  };
  renderContent(filter);
  expect(screen.getByText('Dependent on')).toBeVisible();
  expect(screen.getByText('Native filter 2')).toBeVisible();
});

test('focus filter on filter card dependency click', () => {
  const useDispatchMock = jest.spyOn(reactRedux, 'useDispatch');
  const dummyDispatch = jest.fn();
  useDispatchMock.mockReturnValue(dummyDispatch);

  const filter = {
    ...baseFilter,
    cascadeParentIds: ['NATIVE_FILTER-2'],
  };
  renderContent(filter);

  userEvent.click(screen.getByText('Native filter 2'));
  expect(dummyDispatch).toHaveBeenCalledWith({
    type: SET_DIRECT_PATH,
    path: ['NATIVE_FILTER-2'],
  });
});

test('edit filter button for dashboard viewer', () => {
  renderContent();
  expect(
    screen.queryByRole('button', { name: /edit/i }),
  ).not.toBeInTheDocument();
});

test('edit filter button for dashboard editor', () => {
  renderContent(baseFilter, {
    ...baseInitialState,
    dashboardInfo: { dash_edit_perm: true },
  });

  expect(screen.getByRole('button', { name: /edit/i })).toBeVisible();
});

test('open modal on edit filter button click', async () => {
  renderContent(baseFilter, {
    ...baseInitialState,
    dashboardInfo: { dash_edit_perm: true },
  });

  const editButton = screen.getByRole('button', { name: /edit/i });
  userEvent.click(editButton);
  expect(
    await screen.findByRole('dialog', { name: /add and edit filters/i }),
  ).toBeVisible();
});
