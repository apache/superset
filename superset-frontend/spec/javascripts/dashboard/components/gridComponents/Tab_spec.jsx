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
import { Provider } from 'react-redux';
import React from 'react';
import { styledMount as mount } from 'spec/helpers/theming';
import sinon from 'sinon';

import DashboardComponent from 'src/dashboard/containers/DashboardComponent';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import EditableTitle from 'src/components/EditableTitle';
import Tab, {
  RENDER_TAB,
  RENDER_TAB_CONTENT,
} from 'src/dashboard/components/gridComponents/Tab';
import WithDragDropContext from 'spec/helpers/WithDragDropContext';
import { dashboardLayoutWithTabs } from 'spec/fixtures/mockDashboardLayout';
import { mockStoreWithTabs } from 'spec/fixtures/mockStore';

describe('Tabs', () => {
  const props = {
    id: 'TAB_ID',
    parentId: 'TABS_ID',
    component: dashboardLayoutWithTabs.present.TAB_ID,
    parentComponent: dashboardLayoutWithTabs.present.TABS_ID,
    index: 0,
    depth: 1,
    editMode: false,
    renderType: RENDER_TAB,
    onDropOnTab() {},
    onDeleteTab() {},
    availableColumnCount: 12,
    columnWidth: 50,
    onResizeStart() {},
    onResize() {},
    onResizeStop() {},
    createComponent() {},
    handleComponentDrop() {},
    onChangeTab() {},
    deleteComponent() {},
    updateComponents() {},
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <Provider store={mockStoreWithTabs}>
        <WithDragDropContext>
          <Tab {...props} {...overrideProps} />
        </WithDragDropContext>
      </Provider>,
    );
    return wrapper;
  }

  describe('renderType=RENDER_TAB', () => {
    it('should render a DragDroppable', () => {
      const wrapper = setup();
      expect(wrapper.find(DragDroppable)).toExist();
    });

    it('should render an EditableTitle with meta.text', () => {
      const wrapper = setup();
      const title = wrapper.find(EditableTitle);
      expect(title).toHaveLength(1);
      expect(title.find('.editable-title')).toHaveText(
        props.component.meta.text,
      );
    });

    it('should call updateComponents when EditableTitle changes', () => {
      const updateComponents = sinon.spy();
      const wrapper = setup({ editMode: true, updateComponents });
      wrapper.find(EditableTitle).prop('onSaveTitle')('New title');

      expect(updateComponents.callCount).toBe(1);
      expect(updateComponents.getCall(0).args[0].TAB_ID.meta.text).toBe(
        'New title',
      );
    });
  });

  describe('renderType=RENDER_TAB_CONTENT', () => {
    it('should render a DashboardComponent', () => {
      const wrapper = setup({ renderType: RENDER_TAB_CONTENT });
      // We expect 2 because this Tab has a Row child and the row has a Chart
      expect(wrapper.find(DashboardComponent)).toHaveLength(2);
    });
  });
});
