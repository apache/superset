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
import { mount } from 'enzyme';
import sinon from 'sinon';
import AceEditor from 'react-ace';
import ReactMarkdown from 'react-markdown';

import Markdown from 'src/dashboard/components/gridComponents/Markdown';
import MarkdownModeDropdown from 'src/dashboard/components/menu/MarkdownModeDropdown';
import DeleteComponentButton from 'src/dashboard/components/DeleteComponentButton';
import DragDroppable from 'src/dashboard/components/dnd/DragDroppable';
import WithPopoverMenu from 'src/dashboard/components/menu/WithPopoverMenu';
import ResizableContainer from 'src/dashboard/components/resizable/ResizableContainer';

import { mockStore } from '../../fixtures/mockStore';
import { dashboardLayout as mockLayout } from '../../fixtures/mockDashboardLayout';
import WithDragDropContext from '../../helpers/WithDragDropContext';

describe('Markdown', () => {
  const props = {
    id: 'id',
    parentId: 'parentId',
    component: mockLayout.present.MARKDOWN_ID,
    depth: 2,
    parentComponent: mockLayout.present.ROW_ID,
    index: 0,
    editMode: false,
    availableColumnCount: 12,
    columnWidth: 50,
    onResizeStart() {},
    onResize() {},
    onResizeStop() {},
    handleComponentDrop() {},
    updateComponents() {},
    deleteComponent() {},
    logEvent() {},
  };

  function setup(overrideProps) {
    // We have to wrap provide DragDropContext for the underlying DragDroppable
    // otherwise we cannot assert on DragDroppable children
    const wrapper = mount(
      <Provider store={mockStore}>
        <WithDragDropContext>
          <Markdown {...props} {...overrideProps} />
        </WithDragDropContext>
      </Provider>,
    );
    return wrapper;
  }

  it('should render a DragDroppable', () => {
    const wrapper = setup();
    expect(wrapper.find(DragDroppable)).toExist();
  });

  it('should render a WithPopoverMenu', () => {
    const wrapper = setup();
    expect(wrapper.find(WithPopoverMenu)).toExist();
  });

  it('should render a ResizableContainer', () => {
    const wrapper = setup();
    expect(wrapper.find(ResizableContainer)).toExist();
  });

  it('should only have an adjustableWidth if its parent is a Row', () => {
    let wrapper = setup();
    expect(wrapper.find(ResizableContainer).prop('adjustableWidth')).toBe(true);

    wrapper = setup({ ...props, parentComponent: mockLayout.present.CHART_ID });
    expect(wrapper.find(ResizableContainer).prop('adjustableWidth')).toBe(
      false,
    );
  });

  it('should pass correct props to ResizableContainer', () => {
    const wrapper = setup();
    const resizableProps = wrapper.find(ResizableContainer).props();
    expect(resizableProps.widthStep).toBe(props.columnWidth);
    expect(resizableProps.widthMultiple).toBe(props.component.meta.width);
    expect(resizableProps.heightMultiple).toBe(props.component.meta.height);
    expect(resizableProps.maxWidthMultiple).toBe(
      props.component.meta.width + props.availableColumnCount,
    );
  });

  it('should render an Markdown when NOT focused', () => {
    const wrapper = setup();
    expect(wrapper.find(AceEditor)).not.toExist();
    expect(wrapper.find(ReactMarkdown)).toExist();
  });

  it('should render an AceEditor when focused and editMode=true and editorMode=edit', () => {
    const wrapper = setup({ editMode: true });
    expect(wrapper.find(AceEditor)).not.toExist();
    expect(wrapper.find(ReactMarkdown)).toExist();
    wrapper.find(WithPopoverMenu).simulate('click'); // focus + edit
    expect(wrapper.find(AceEditor)).toExist();
    expect(wrapper.find(ReactMarkdown)).not.toExist();
  });

  it('should render a ReactMarkdown when focused and editMode=true and editorMode=preview', () => {
    const wrapper = setup({ editMode: true });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus + edit
    expect(wrapper.find(AceEditor)).toExist();
    expect(wrapper.find(ReactMarkdown)).not.toExist();

    // we can't call setState on Markdown bc it's not the root component, so call
    // the mode dropdown onchange instead
    const dropdown = wrapper.find(MarkdownModeDropdown);
    dropdown.prop('onChange')('preview');
    wrapper.update();

    expect(wrapper.find(ReactMarkdown)).toExist();
    expect(wrapper.find(AceEditor)).not.toExist();
  });

  it('should call updateComponents when editMode changes from edit => preview, and there are markdownSource changes', () => {
    const updateComponents = sinon.spy();
    const wrapper = setup({ editMode: true, updateComponents });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus + edit

    // we can't call setState on Markdown bc it's not the root component, so call
    // the mode dropdown onchange instead
    const dropdown = wrapper.find(MarkdownModeDropdown);
    dropdown.prop('onChange')('preview');
    expect(updateComponents.callCount).toBe(0);

    dropdown.prop('onChange')('edit');
    // because we can't call setState on Markdown, change it through the editor
    // then go back to preview mode to invoke updateComponents
    const editor = wrapper.find(AceEditor);
    editor.prop('onChange')('new markdown!');
    dropdown.prop('onChange')('preview');
    expect(updateComponents.callCount).toBe(1);
  });

  it('should render a DeleteComponentButton when focused in editMode', () => {
    const wrapper = setup({ editMode: true });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus

    expect(wrapper.find(DeleteComponentButton)).toExist();
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus
    wrapper.find(DeleteComponentButton).simulate('click');

    expect(deleteComponent.callCount).toBe(1);
  });
});
