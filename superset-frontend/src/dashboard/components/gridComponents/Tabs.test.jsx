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
import { fireEvent, render } from 'spec/helpers/testing-library';

import { AntdModal } from 'src/components';
import fetchMock from 'fetch-mock';
import { Tabs } from 'src/dashboard/components/gridComponents/Tabs';
import { DASHBOARD_ROOT_ID } from 'src/dashboard/util/constants';
import emptyDashboardLayout from 'src/dashboard/fixtures/emptyDashboardLayout';
import { dashboardLayoutWithTabs } from 'spec/fixtures/mockDashboardLayout';
import { getMockStore } from 'spec/fixtures/mockStore';
import { nativeFilters } from 'spec/fixtures/mockNativeFilters';
import { initialState } from 'src/SqlLab/fixtures';

jest.mock('src/dashboard/components/dnd/DragDroppable', () => ({
  Draggable: ({ children }) => (
    <div data-test="mock-draggable">{children({})}</div>
  ),
  Droppable: ({ children }) => (
    <div data-test="mock-droppable">{children({})}</div>
  ),
}));
jest.mock('src/dashboard/containers/DashboardComponent', () => ({ id }) => (
  <div data-test="mock-dashboard-component">{id}</div>
));

jest.mock(
  'src/dashboard/components/DeleteComponentButton',
  () =>
    ({ onDelete }) => (
      <button
        type="button"
        data-test="mock-delete-component-button"
        onClick={onDelete}
      >
        Delete
      </button>
    ),
);

fetchMock.post('glob:*/r/shortener/', {});

const props = {
  id: 'TABS_ID',
  parentId: DASHBOARD_ROOT_ID,
  component: dashboardLayoutWithTabs.present.TABS_ID,
  parentComponent: dashboardLayoutWithTabs.present[DASHBOARD_ROOT_ID],
  index: 0,
  depth: 1,
  renderTabContent: true,
  editMode: false,
  availableColumnCount: 12,
  columnWidth: 50,
  dashboardId: 1,
  onResizeStart() {},
  onResize() {},
  onResizeStop() {},
  createComponent() {},
  handleComponentDrop() {},
  onChangeTab() {},
  deleteComponent() {},
  updateComponents() {},
  logEvent() {},
  dashboardLayout: emptyDashboardLayout,
  nativeFilters: nativeFilters.filters,
};

const mockStore = getMockStore({
  ...initialState,
  dashboardLayout: dashboardLayoutWithTabs,
  dashboardFilters: {},
});

function setup(overrideProps) {
  return render(<Tabs {...props} {...overrideProps} />, {
    useDnd: true,
    useRouter: true,
    store: mockStore,
  });
}

test('should render a Draggable', () => {
  // test just Tabs with no children Draggable
  const { getByTestId } = setup({
    component: { ...props.component, children: [] },
  });
  expect(getByTestId('mock-draggable')).toBeInTheDocument();
});

test('should render non-editable tabs', () => {
  const { getAllByRole, container } = setup();
  expect(getAllByRole('tab')[0]).toBeInTheDocument();
  expect(container.querySelector('.ant-tabs-nav-add')).not.toBeInTheDocument();
});

test('should render a tab pane for each child', () => {
  const { getAllByRole } = setup();
  expect(getAllByRole('tab')).toHaveLength(props.component.children.length);
});

test('should render editable tabs in editMode', () => {
  const { getAllByRole, container } = setup({ editMode: true });
  expect(getAllByRole('tab')[0]).toBeInTheDocument();
  expect(container.querySelector('.ant-tabs-nav-add')).toBeInTheDocument();
});

test('should render a DashboardComponent for each child', () => {
  // note: this does not test Tab content
  const { getAllByTestId } = setup({ renderTabContent: false });
  expect(getAllByTestId('mock-dashboard-component')).toHaveLength(
    props.component.children.length,
  );
});

test('should call createComponent if the (+) tab is clicked', () => {
  const createComponent = jest.fn();
  const { getAllByRole } = setup({ editMode: true, createComponent });
  const addButtons = getAllByRole('button', { name: 'Add tab' });
  fireEvent.click(addButtons[0]);
  expect(createComponent).toHaveBeenCalledTimes(1);
});

test('should call onChangeTab when a tab is clicked', () => {
  const onChangeTab = jest.fn();
  const { getByRole } = setup({ editMode: true, onChangeTab });
  const newTab = getByRole('tab', { selected: false });
  fireEvent.click(newTab);
  expect(onChangeTab).toHaveBeenCalledTimes(1);
});

test('should not call onChangeTab when anchor link is clicked', () => {
  const onChangeTab = jest.fn();
  const { getByRole } = setup({ editMode: true, onChangeTab });
  const currentTab = getByRole('tab', { selected: true });
  fireEvent.click(currentTab);

  expect(onChangeTab).toHaveBeenCalledTimes(0);
});

test('should render a HoverMenu in editMode', () => {
  const { container } = setup({ editMode: true });
  expect(container.querySelector('.hover-menu')).toBeInTheDocument();
});

test('should render a DeleteComponentButton in editMode', () => {
  const { getByTestId } = setup({ editMode: true });
  expect(getByTestId('mock-delete-component-button')).toBeInTheDocument();
});

test('should call deleteComponent when deleted', () => {
  const deleteComponent = jest.fn();
  const { getByTestId } = setup({ editMode: true, deleteComponent });
  fireEvent.click(getByTestId('mock-delete-component-button'));
  expect(deleteComponent).toHaveBeenCalledTimes(1);
});

test('should direct display direct-link tab', () => {
  // display child in directPathToChild list
  const directPathToChild =
    dashboardLayoutWithTabs.present.ROW_ID2.parents.slice();
  const directLinkProps = {
    ...props,
    directPathToChild,
  };
  const { getByRole } = setup(directLinkProps);
  expect(getByRole('tab', { selected: true })).toHaveTextContent('TAB_ID2');
});

test('should render Modal when clicked remove tab button', () => {
  const deleteComponent = jest.fn();
  const modalMock = jest.spyOn(AntdModal, 'confirm');
  const { container } = setup({ editMode: true, deleteComponent });
  fireEvent.click(container.querySelector('.ant-tabs-tab-remove'));
  expect(modalMock).toHaveBeenCalledTimes(1);
  expect(deleteComponent).toHaveBeenCalledTimes(0);
});

test('should set new tab key if dashboardId was changed', () => {
  const { getByRole } = setup({
    ...props,
    dashboardId: 2,
    component: dashboardLayoutWithTabs.present.TAB_ID,
  });
  expect(getByRole('tab', { selected: true })).toHaveTextContent('ROW_ID');
});
