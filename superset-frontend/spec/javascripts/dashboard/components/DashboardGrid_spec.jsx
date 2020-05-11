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
import { shallow } from 'enzyme';
import sinon from 'sinon';

import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DashboardGrid from 'src/dashboard/components/DashboardGrid';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import newComponentFactory from 'src/dashboard/util/newComponentFactory';

import { DASHBOARD_GRID_TYPE } from 'src/dashboard/util/componentTypes';
import { GRID_COLUMN_COUNT } from 'src/dashboard/util/constants';

describe('DashboardGrid', () => {
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
  };

  function setup(overrideProps) {
    const wrapper = shallow(<DashboardGrid {...props} {...overrideProps} />);
    return wrapper;
  }

  it('should render a div with class "dashboard-grid"', () => {
    const wrapper = setup();
    expect(wrapper.find('.dashboard-grid')).toHaveLength(1);
  });

  it('should render one DashboardComponent for each gridComponent child', () => {
    const wrapper = setup({
      gridComponent: { ...props.gridComponent, children: ['a', 'b'] },
    });
    expect(wrapper.find(DashboardComponent)).toHaveLength(2);
  });

  it('should render two empty DragDroppables in editMode to increase the drop target zone', () => {
    const viewMode = setup({ editMode: false });
    const editMode = setup({ editMode: true });
    expect(viewMode.find(DragDroppable)).toHaveLength(0);
    expect(editMode.find(DragDroppable)).toHaveLength(2);
  });

  it('should render grid column guides when resizing', () => {
    const wrapper = setup({ editMode: true });
    expect(wrapper.find('.grid-column-guide')).toHaveLength(0);

    wrapper.setState({ isResizing: true });

    expect(wrapper.find('.grid-column-guide')).toHaveLength(GRID_COLUMN_COUNT);
  });

  it('should render a grid row guide when resizing', () => {
    const wrapper = setup();
    expect(wrapper.find('.grid-row-guide')).toHaveLength(0);
    wrapper.setState({ isResizing: true, rowGuideTop: 10 });
    expect(wrapper.find('.grid-row-guide')).toHaveLength(1);
  });

  it('should call resizeComponent when a child DashboardComponent calls resizeStop', () => {
    const resizeComponent = sinon.spy();
    const args = { id: 'id', widthMultiple: 1, heightMultiple: 3 };
    const wrapper = setup({ resizeComponent });
    const dashboardComponent = wrapper.find(DashboardComponent).first();
    dashboardComponent.prop('onResizeStop')(args);

    expect(resizeComponent.callCount).toBe(1);
    expect(resizeComponent.getCall(0).args[0]).toEqual({
      id: 'id',
      width: 1,
      height: 3,
    });
  });
});
