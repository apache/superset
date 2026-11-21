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
import type { FC } from 'react';
import { render, screen } from 'spec/helpers/testing-library';

// Tab.tsx is statically imported below; the mock pattern intercepts
// applicationRoot() rather than relying on withApplicationRoot (which is for
// dynamic-import unit tests).

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

jest.mock('src/dashboard/util/getChartIdsFromComponent', () =>
  jest.fn(() => []),
);
jest.mock('src/dashboard/containers/DashboardComponent', () =>
  jest.fn(() => <div data-test="DashboardComponent" />),
);
jest.mock('@superset-ui/core/components/EditableTitle', () => ({
  __esModule: true,
  EditableTitle: jest.fn(() => <div data-test="EditableTitle" />),
}));
jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  ...jest.requireActual('src/dashboard/components/dnd/DragDroppable'),
  Droppable: jest.fn(props => (
    <div>{props.children ? props.children({}) : null}</div>
  )),
}));

// eslint-disable-next-line import/first
import ActualTab from './Tab';

const Tab = ActualTab as unknown as FC<Record<string, unknown>>;

const DASHBOARD_ID = 23;

const buildProps = () => ({
  id: 'TAB-empty-',
  parentId: 'TABS-empty-',
  depth: 2,
  index: 0,
  renderType: 'RENDER_TAB_CONTENT',
  availableColumnCount: 12,
  columnWidth: 120,
  isFocused: false,
  component: {
    children: [],
    id: 'TAB-empty-',
    meta: { text: 'Empty Tab' },
    parents: ['ROOT_ID', 'GRID_ID', 'TABS-empty-'],
    type: 'TAB',
  },
  parentComponent: {
    children: ['TAB-empty-'],
    id: 'TABS-empty-',
    meta: {},
    parents: ['ROOT_ID', 'GRID_ID'],
    type: 'TABS',
  },
  editMode: true,
  embeddedMode: false,
  undoLength: 0,
  redoLength: 0,
  filters: {},
  directPathToChild: [],
  directPathLastUpdated: 0,
  dashboardId: DASHBOARD_ID,
  focusedFilterScope: null,
  isComponentVisible: true,
  onDropOnTab: jest.fn(),
  handleComponentDrop: jest.fn(),
  updateComponents: jest.fn(),
  setDirectPathToChild: jest.fn(),
  onResizeStart: jest.fn(),
  onResize: jest.fn(),
  onResizeStop: jest.fn(),
});

const renderEmptyEditModeTab = () =>
  render(<Tab {...buildProps()} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardInfo: { dash_edit_perm: true },
    },
  });

beforeEach(() => {
  mockApplicationRoot.mockReturnValue('');
});

test('Tab — empty edit-mode "create a new chart" link is unprefixed when application root is empty', () => {
  mockApplicationRoot.mockReturnValue('');
  renderEmptyEditModeTab();

  expect(
    screen.getByRole('link', { name: 'create a new chart' }),
  ).toHaveAttribute('href', `/chart/add?dashboard_id=${DASHBOARD_ID}`);
});

test('Tab — empty edit-mode "create a new chart" link carries the application root under subdirectory deployment', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  renderEmptyEditModeTab();

  // Single prefix — not /superset/superset/ — verifying ensureAppRoot's
  // dedupe boundary holds against the path's leading slash.
  expect(
    screen.getByRole('link', { name: 'create a new chart' }),
  ).toHaveAttribute('href', `/superset/chart/add?dashboard_id=${DASHBOARD_ID}`);
});

test('Tab — empty edit-mode "create a new chart" link prefixes correctly for nested subdirectory roots', () => {
  mockApplicationRoot.mockReturnValue('/a/b/c');
  renderEmptyEditModeTab();

  expect(
    screen.getByRole('link', { name: 'create a new chart' }),
  ).toHaveAttribute('href', `/a/b/c/chart/add?dashboard_id=${DASHBOARD_ID}`);
});
