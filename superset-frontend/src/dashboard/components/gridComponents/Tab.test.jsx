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

import { render, screen, fireEvent } from 'spec/helpers/testing-library';

import { Provider } from 'react-redux';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import Tab, { RENDER_TAB } from 'src/dashboard/components/gridComponents/Tab';
import { dashboardLayoutWithTabs } from 'spec/fixtures/mockDashboardLayout';
import { getMockStore } from 'spec/fixtures/mockStore';

// TODO: rewrite to RTL
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
    filters: {},
    dashboardId: 123,
    setDirectPathToChild: jest.fn(),
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
    dropToChild: false,
    maxChildrenHeight: 100,
    shouldDropToChild: () => false, // Add this prop
  };

  function setup(overrideProps = {}) {
    return render(
      <Provider
        store={getMockStore({
          dashboardLayout: dashboardLayoutWithTabs,
        })}
      >
        <DndProvider backend={HTML5Backend}>
          <Tab {...props} {...overrideProps} />
        </DndProvider>
      </Provider>,
    );
  }

  describe('renderType=RENDER_TAB', () => {
    it('should render a DragDroppable', () => {
      setup();
      expect(screen.getByTestId('dragdroppable-object')).toBeInTheDocument();
    });

    it('should render an EditableTitle with meta.text', () => {
      setup();
      const titleElement = screen.getByTestId('editable-title');
      expect(titleElement).toBeInTheDocument();
      expect(titleElement).toHaveTextContent(
        props.component.meta.defaultText || '',
      );
    });

    it('should call updateComponents when EditableTitle changes', async () => {
      const updateComponents = jest.fn();
      setup({
        editMode: true,
        updateComponents,
        component: {
          ...dashboardLayoutWithTabs.present.TAB_ID,
          meta: {
            text: 'Original Title',
            defaultText: 'Original Title', // Add defaultText to match component
          },
        },
        isFocused: true,
      });

      const titleElement = screen.getByTestId('editable-title');
      fireEvent.click(titleElement);

      const titleInput = await screen.findByTestId('editable-title-input');
      fireEvent.change(titleInput, { target: { value: 'New title' } });
      fireEvent.blur(titleInput);

      expect(updateComponents).toHaveBeenCalledWith({
        TAB_ID: {
          ...dashboardLayoutWithTabs.present.TAB_ID,
          meta: {
            ...dashboardLayoutWithTabs.present.TAB_ID.meta,
            text: 'New title',
            defaultText: 'Original Title', // Keep the original defaultText
          },
        },
      });
    });
  });

  describe('renderType=RENDER_TAB_CONTENT', () => {
    it('should render DashboardComponents', () => {
      setup({
        renderType: 'RENDER_TAB_CONTENT',
        component: {
          ...dashboardLayoutWithTabs.present.TAB_ID,
          children: ['ROW_ID'],
        },
      });

      expect(
        screen.getByTestId('dashboard-component-chart-holder'),
      ).toBeInTheDocument();
    });
  });
});
