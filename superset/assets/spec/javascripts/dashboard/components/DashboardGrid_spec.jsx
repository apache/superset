import React from 'react';
import { shallow } from 'enzyme';
import { expect } from 'chai';
import sinon from 'sinon';

import DashboardComponent from '../../../../src/dashboard/containers/DashboardComponent';
import DashboardGrid from '../../../../src/dashboard/components/DashboardGrid';
import DragDroppable from '../../../../src/dashboard/components/dnd/DragDroppable';
import newComponentFactory from '../../../../src/dashboard/util/newComponentFactory';

import { DASHBOARD_GRID_TYPE } from '../../../../src/dashboard/util/componentTypes';
import { GRID_COLUMN_COUNT } from '../../../../src/dashboard/util/constants';

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
    expect(wrapper.find('.dashboard-grid')).to.have.length(1);
  });

  it('should render one DashboardComponent for each gridComponent child', () => {
    const wrapper = setup({
      gridComponent: { ...props.gridComponent, children: ['a', 'b'] },
    });
    expect(wrapper.find(DashboardComponent)).to.have.length(2);
  });

  it('should render two empty DragDroppables in editMode to increase the drop target zone', () => {
    const viewMode = setup({ editMode: false });
    const editMode = setup({ editMode: true });
    expect(viewMode.find(DragDroppable)).to.have.length(0);
    expect(editMode.find(DragDroppable)).to.have.length(2);
  });

  it('should render grid column guides when resizing', () => {
    const wrapper = setup({ editMode: true });
    expect(wrapper.find('.grid-column-guide')).to.have.length(0);

    wrapper.setState({ isResizing: true });

    expect(wrapper.find('.grid-column-guide')).to.have.length(
      GRID_COLUMN_COUNT,
    );
  });

  it('should render a grid row guide when resizing', () => {
    const wrapper = setup();
    expect(wrapper.find('.grid-row-guide')).to.have.length(0);
    wrapper.setState({ isResizing: true, rowGuideTop: 10 });
    expect(wrapper.find('.grid-row-guide')).to.have.length(1);
  });

  it('should call resizeComponent when a child DashboardComponent calls resizeStop', () => {
    const resizeComponent = sinon.spy();
    const args = { id: 'id', widthMultiple: 1, heightMultiple: 3 };
    const wrapper = setup({ resizeComponent });
    const dashboardComponent = wrapper.find(DashboardComponent).first();
    dashboardComponent.prop('onResizeStop')(args);

    expect(resizeComponent.callCount).to.equal(1);
    expect(resizeComponent.getCall(0).args[0]).to.deep.equal({
      id: 'id',
      width: 1,
      height: 3,
    });
  });
});
