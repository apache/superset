import { Provider } from 'react-redux';
import React from 'react';
import { mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import AceEditor from 'react-ace';
import ReactMarkdown from 'react-markdown';

import Markdown from '../../../../../src/dashboard/components/gridComponents/Markdown';
import MarkdownModeDropdown from '../../../../../src/dashboard/components/menu/MarkdownModeDropdown';
import DeleteComponentButton from '../../../../../src/dashboard/components/DeleteComponentButton';
import DragDroppable from '../../../../../src/dashboard/components/dnd/DragDroppable';
import WithPopoverMenu from '../../../../../src/dashboard/components/menu/WithPopoverMenu';
import ResizableContainer from '../../../../../src/dashboard/components/resizable/ResizableContainer';

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
    expect(wrapper.find(DragDroppable)).to.have.length(1);
  });

  it('should render a WithPopoverMenu', () => {
    const wrapper = setup();
    expect(wrapper.find(WithPopoverMenu)).to.have.length(1);
  });

  it('should render a ResizableContainer', () => {
    const wrapper = setup();
    expect(wrapper.find(ResizableContainer)).to.have.length(1);
  });

  it('should only have an adjustableWidth if its parent is a Row', () => {
    let wrapper = setup();
    expect(wrapper.find(ResizableContainer).prop('adjustableWidth')).to.equal(
      true,
    );

    wrapper = setup({ ...props, parentComponent: mockLayout.present.CHART_ID });
    expect(wrapper.find(ResizableContainer).prop('adjustableWidth')).to.equal(
      false,
    );
  });

  it('should pass correct props to ResizableContainer', () => {
    const wrapper = setup();
    const resizableProps = wrapper.find(ResizableContainer).props();
    expect(resizableProps.widthStep).to.equal(props.columnWidth);
    expect(resizableProps.widthMultiple).to.equal(props.component.meta.width);
    expect(resizableProps.heightMultiple).to.equal(props.component.meta.height);
    expect(resizableProps.maxWidthMultiple).to.equal(
      props.component.meta.width + props.availableColumnCount,
    );
  });

  it('should render an Markdown when NOT focused', () => {
    const wrapper = setup();
    expect(wrapper.find(AceEditor)).to.have.length(0);
    expect(wrapper.find(ReactMarkdown)).to.have.length(1);
  });

  it('should render an AceEditor when focused and editMode=true and editorMode=edit', () => {
    const wrapper = setup({ editMode: true });
    expect(wrapper.find(AceEditor)).to.have.length(0);
    expect(wrapper.find(ReactMarkdown)).to.have.length(1);
    wrapper.find(WithPopoverMenu).simulate('click'); // focus + edit
    expect(wrapper.find(AceEditor)).to.have.length(1);
    expect(wrapper.find(ReactMarkdown)).to.have.length(0);
  });

  it('should render a ReactMarkdown when focused and editMode=true and editorMode=preview', () => {
    const wrapper = setup({ editMode: true });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus + edit
    expect(wrapper.find(AceEditor)).to.have.length(1);
    expect(wrapper.find(ReactMarkdown)).to.have.length(0);

    // we can't call setState on Markdown bc it's not the root component, so call
    // the mode dropdown onchange instead
    const dropdown = wrapper.find(MarkdownModeDropdown);
    dropdown.prop('onChange')('preview');

    expect(wrapper.find(AceEditor)).to.have.length(0);
    expect(wrapper.find(ReactMarkdown)).to.have.length(1);
  });

  it('should call updateComponents when editMode changes from edit => preview, and there are markdownSource changes', () => {
    const updateComponents = sinon.spy();
    const wrapper = setup({ editMode: true, updateComponents });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus + edit

    // we can't call setState on Markdown bc it's not the root component, so call
    // the mode dropdown onchange instead
    const dropdown = wrapper.find(MarkdownModeDropdown);
    dropdown.prop('onChange')('preview');
    expect(updateComponents.callCount).to.equal(0);

    dropdown.prop('onChange')('edit');
    // because we can't call setState on Markdown, change it through the editor
    // then go back to preview mode to invoke updateComponents
    const editor = wrapper.find(AceEditor);
    editor.prop('onChange')('new markdown!');
    dropdown.prop('onChange')('preview');
    expect(updateComponents.callCount).to.equal(1);
  });

  it('should render a DeleteComponentButton when focused in editMode', () => {
    const wrapper = setup({ editMode: true });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus

    expect(wrapper.find(DeleteComponentButton)).to.have.length(1);
  });

  it('should call deleteComponent when deleted', () => {
    const deleteComponent = sinon.spy();
    const wrapper = setup({ editMode: true, deleteComponent });
    wrapper.find(WithPopoverMenu).simulate('click'); // focus
    wrapper.find(DeleteComponentButton).simulate('click');

    expect(deleteComponent.callCount).to.equal(1);
  });
});
