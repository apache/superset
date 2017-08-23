import React from 'react';
import { shallow, mount } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import SplitPane from '../../../javascripts/SqlLab/components/SplitPane';

function simulateWindowEvent(eventName, customProps) {
  const evt = document.createEvent('Event');
  evt.initEvent(eventName, true, true);
  global.window.dispatchEvent(Object.assign(evt, customProps));
}

const TestComponent = () => (<div className="test" />);

describe('ResizableAceEditor', () => {
  const mockedProps = {
    north: () => <div className="stub north" />,
    south: () => <div className="stub south" />,
  };
  let clock;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });
  afterEach(() => {
    clock.restore();
  });


  it('is valid', () => {
    expect(
      React.isValidElement(<SplitPane {...mockedProps} />),
    ).to.equal(true);
  });
  it('renders what you provide in north', () => {
    const wrapper = shallow(<SplitPane {...mockedProps} north={<TestComponent />} />);
    expect(wrapper.find(TestComponent)).to.have.length(1);
  });
  it('renders what you provide in south', () => {
    const wrapper = shallow(<SplitPane {...mockedProps} south={<TestComponent />} />);
    expect(wrapper.find(TestComponent)).to.have.length(1);
  });
  it('render a DragBar', () => {
    const wrapper = shallow(<SplitPane {...mockedProps} />);
    expect(wrapper.find('.DragBar')).to.have.length(1);
  });
  it('has dragging set to false by default', () => {
    const wrapper = shallow(<SplitPane {...mockedProps} />);
    expect(wrapper.state().dragging).to.be.equal(false);
  });
  it('has dragging set to true when dragged', () => {
    const wrapper = shallow(<SplitPane {...mockedProps} />);
    const dragbar = wrapper.find('.DragBar');
    dragbar.simulate('mouseDown');
    expect(wrapper.state().dragging).to.be.equal(true);
  });
  it('has dragging set to false when dropped', () => {
    const wrapper = mount(<SplitPane {...mockedProps} />);
    const dragbar = wrapper.find('.DragBar');
    dragbar.simulate('mouseDown');
    simulateWindowEvent('mouseup');
    expect(wrapper.state().dragging).to.be.equal(false);
  });
});
