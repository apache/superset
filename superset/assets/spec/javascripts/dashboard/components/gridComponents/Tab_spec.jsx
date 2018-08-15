import { Provider } from 'react-redux';
import React from 'react';
import { mount } from 'enzyme';
import { expect } from 'chai';
import sinon from 'sinon';

import DashboardComponent from '../../../../../src/dashboard/containers/DashboardComponent';
import DeleteComponentModal from '../../../../../src/dashboard/components/DeleteComponentModal';
import DragDroppable from '../../../../../src/dashboard/components/dnd/DragDroppable';
import EditableTitle from '../../../../../src/components/EditableTitle';
import WithPopoverMenu from '../../../../../src/dashboard/components/menu/WithPopoverMenu';
import Tab, {
  RENDER_TAB,
  RENDER_TAB_CONTENT,
} from '../../../../../src/dashboard/components/gridComponents/Tab';
import WithDragDropContext from '../../helpers/WithDragDropContext';
import { dashboardLayoutWithTabs } from '../../fixtures/mockDashboardLayout';
import { mockStoreWithTabs } from '../../fixtures/mockStore';

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
      expect(wrapper.find(DragDroppable)).to.have.length(1);
    });

    it('should render an EditableTitle with meta.text', () => {
      const wrapper = setup();
      const title = wrapper.find(EditableTitle);
      expect(title).to.have.length(1);
      expect(title.find('input').prop('value')).to.equal(
        props.component.meta.text,
      );
    });

    it('should call updateComponents when EditableTitle changes', () => {
      const updateComponents = sinon.spy();
      const wrapper = setup({ editMode: true, updateComponents });
      wrapper.find(EditableTitle).prop('onSaveTitle')('New title');

      expect(updateComponents.callCount).to.equal(1);
      expect(updateComponents.getCall(0).args[0].TAB_ID.meta.text).to.equal(
        'New title',
      );
    });

    it('should render a WithPopoverMenu', () => {
      const wrapper = setup();
      expect(wrapper.find(WithPopoverMenu)).to.have.length(1);
    });

    it('should render a DeleteComponentModal when focused if its not the only tab', () => {
      let wrapper = setup();
      wrapper.find(WithPopoverMenu).simulate('click'); // focus
      expect(wrapper.find(DeleteComponentModal)).to.have.length(0);

      wrapper = setup({ editMode: true });
      wrapper.find(WithPopoverMenu).simulate('click');
      expect(wrapper.find(DeleteComponentModal)).to.have.length(1);

      wrapper = setup({
        editMode: true,
        parentComponent: {
          ...props.parentComponent,
          children: props.parentComponent.children.slice(0, 1),
        },
      });
      wrapper.find(WithPopoverMenu).simulate('click');
      expect(wrapper.find(DeleteComponentModal)).to.have.length(0);
    });

    it('should show modal when clicked delete icon', () => {
      const deleteComponent = sinon.spy();
      const wrapper = setup({ editMode: true, deleteComponent });
      wrapper.find(WithPopoverMenu).simulate('click'); // focus
      wrapper.find('.icon-button').simulate('click');

      const modal = document.getElementsByClassName('modal');
      expect(modal).to.have.length(1);
      expect(deleteComponent.callCount).to.equal(0);
    });
  });

  describe('renderType=RENDER_TAB_CONTENT', () => {
    it('should render a DashboardComponent', () => {
      const wrapper = setup({ renderType: RENDER_TAB_CONTENT });
      // We expect 2 because this Tab has a Row child and the row has a Chart
      expect(wrapper.find(DashboardComponent)).to.have.length(2);
    });
  });
});
