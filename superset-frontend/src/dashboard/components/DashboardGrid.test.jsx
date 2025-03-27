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

import DashboardGrid from 'src/dashboard/components/DashboardGrid';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';

import { DASHBOARD_GRID_TYPE } from 'src/dashboard/util/componentTypes';
import { GRID_COLUMN_COUNT } from 'src/dashboard/util/constants';

jest.mock(
  'src/dashboard/containers/DashboardComponent',
  () =>
    ({ onResizeStart, onResizeStop }) => (
      <button
        type="button"
        data-test="mock-dashboard-component"
        onClick={() => onResizeStart()}
        onBlur={() =>
          onResizeStop(null, null, null, { width: 1, height: 3 }, 'id')
        }
      >
        Mock
      </button>
    ),
);

const props = {
  depth: 1,
  editMode: false,
  gridComponent: {
    ...newComponentFactory(DASHBOARD_GRID_TYPE),
    children: ['a'],
  },
  handleComponentDrop() {},
  resizeComponent() {},
  width: 500,
  isComponentVisible: true,
  setDirectPathToChild() {},
};

function setup(overrideProps) {
  return render(<DashboardGrid {...props} {...overrideProps} />, {
    useRedux: true,
    useDnd: true,
  });
}

test('should render a div with class "dashboard-grid"', () => {
  const { container } = setup();
  expect(container.querySelector('.dashboard-grid')).toBeInTheDocument();
});

test('should render one DashboardComponent for each gridComponent child', () => {
  const { getAllByTestId } = setup({
    gridComponent: { ...props.gridComponent, children: ['a', 'b'] },
  });
  expect(getAllByTestId('mock-dashboard-component')).toHaveLength(2);
});

test('should render two empty DragDroppables in editMode to increase the drop target zone', () => {
  const { queryAllByTestId } = setup({ editMode: false });
  expect(queryAllByTestId('dragdroppable-object').length).toEqual(0);
  const { getAllByTestId } = setup({ editMode: true });
  expect(getAllByTestId('dragdroppable-object').length).toEqual(2);
});

test('should render grid column guides when resizing', () => {
  const { container, getAllByTestId } = setup({ editMode: true });
  expect(container.querySelector('.grid-column-guide')).not.toBeInTheDocument();

  // map handleResizeStart to the onClick prop of the mock DashboardComponent
  fireEvent.click(getAllByTestId('mock-dashboard-component')[0]);

  expect(container.querySelectorAll('.grid-column-guide')).toHaveLength(
    GRID_COLUMN_COUNT,
  );
});

test('should call resizeComponent when a child DashboardComponent calls resizeStop', () => {
  const resizeComponent = jest.fn();
  const { getAllByTestId } = setup({ resizeComponent });
  const dashboardComponent = getAllByTestId('mock-dashboard-component')[0];
  fireEvent.blur(dashboardComponent);

  expect(resizeComponent).toHaveBeenCalledTimes(1);
  expect(resizeComponent).toHaveBeenCalledWith({
    id: 'id',
    width: 1,
    height: 3,
  });
});
