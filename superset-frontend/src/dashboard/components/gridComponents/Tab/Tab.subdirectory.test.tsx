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
import { render, screen } from 'spec/helpers/testing-library';

// The empty-tab "create a new chart" link is a plain anchor, so it bypasses the
// router basename that prefixes the rest of the app. It must apply the
// application root itself or the link 404s under a subdirectory deployment.
//
// Tab is imported statically; mock getBootstrapData and flip applicationRoot()
// per scenario. The name must start with `mock` for Jest's hoisted factory.
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
import Tab from './Tab';

const DASHBOARD_ID = 23;

const createProps = () => ({
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
});

const renderEmptyEditModeTab = () =>
  render(<Tab {...createProps()} />, {
    useRedux: true,
    useDnd: true,
    initialState: {
      dashboardInfo: {
        dash_edit_perm: true,
      },
    },
  });

const createChartLink = () =>
  screen.getByRole('link', { name: 'create a new chart' });

beforeEach(() => {
  mockApplicationRoot.mockReset();
});

test('"create a new chart" link is unprefixed under the default root-of-domain deployment', () => {
  mockApplicationRoot.mockReturnValue('');
  renderEmptyEditModeTab();

  expect(createChartLink()).toHaveAttribute(
    'href',
    `/chart/add?dashboard_id=${DASHBOARD_ID}`,
  );
});

test('"create a new chart" link carries the application root under a subdirectory deployment', () => {
  mockApplicationRoot.mockReturnValue('/superset');
  renderEmptyEditModeTab();

  expect(createChartLink()).toHaveAttribute(
    'href',
    `/superset/chart/add?dashboard_id=${DASHBOARD_ID}`,
  );
});

test('"create a new chart" link carries a nested application root', () => {
  mockApplicationRoot.mockReturnValue('/a/b/c');
  renderEmptyEditModeTab();

  expect(createChartLink()).toHaveAttribute(
    'href',
    `/a/b/c/chart/add?dashboard_id=${DASHBOARD_ID}`,
  );
});
