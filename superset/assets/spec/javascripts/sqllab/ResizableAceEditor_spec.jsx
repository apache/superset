import React from 'react';
import { shallow } from 'enzyme';
import { describe, it } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';

import * as commonUtils from '../../../utils/common';

import ResizableAceEditore from '../../../javascripts/SqlLab/components/ResizableAceEditor';
import AceEditorWrapper from '../../../javascripts/SqlLab/components/AceEditorWrapper';

function simulateWindowEvent(eventName, customProps) {
  const evt = document.createEvent('Event');
  evt.initEvent(eventName, true, true);
  global.window.dispatchEvent(Object.assign(evt, customProps));
}

function stubGetTopOffset(value) {
  commonUtils.getTopOffset = sinon.stub().returns(value);
}

describe('ResizableAceEditor', () => {
  it('is valid', () => {
    expect(
      React.isValidElement(<ResizableAceEditore />),
    ).to.equal(true);
  });
  it('render a AceEditorWrapper', () => {
    const wrapper = shallow(<ResizableAceEditore />);
    expect(wrapper.find(AceEditorWrapper)).to.have.length(1);
  });
  it('render a DragBar', () => {
    const wrapper = shallow(<ResizableAceEditore />);
    expect(wrapper.find('.DragBar')).to.have.length(1);
  });
  it('has dragging set to false by default', () => {
    const wrapper = shallow(<ResizableAceEditore />);
    expect(wrapper.state().dragging).to.be.equal(false);
  });
  it('has dragging set to true when dragged', () => {
    const wrapper = shallow(<ResizableAceEditore />);
    const dragbar = wrapper.find('.DragBar');
    dragbar.simulate('mouseDown');
    expect(wrapper.state().dragging).to.be.equal(true);
  });
  it('has dragging set to false when dropped', () => {
    const wrapper = shallow(<ResizableAceEditore />);
    const dragbar = wrapper.find('.DragBar');
    dragbar.simulate('mouseDown');
    simulateWindowEvent('mouseup');
    expect(wrapper.state().dragging).to.be.equal(false);
  });
  it('adjusts height on mousemove', () => {
    stubGetTopOffset(0);
    const wrapper = shallow(<ResizableAceEditore />);
    const dragbar = wrapper.find('.DragBar');
    dragbar.simulate('mouseDown');
    simulateWindowEvent('mousemove', { pageY: 100 });
    expect(wrapper.state().editorHeight).to.be.equal(100);
  });
});
