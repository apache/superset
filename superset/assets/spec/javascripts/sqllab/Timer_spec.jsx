import React from 'react';
import { mount } from 'enzyme';
import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';

import Timer from '../../../javascripts/components/Timer';
import { now } from '../../../javascripts/modules/dates';


describe('Timer', () => {
  let wrapper;
  const mockedProps = {
    startTime: now(),
    endTime: null,
    isRunning: true,
    status: 'warning',
  };

  beforeEach(() => {
    wrapper = mount(<Timer {...mockedProps} />);
  });

  it('is a valid element', () => {
    expect(React.isValidElement(<Timer {...mockedProps} />)).to.equal(true);
  });

  it('componentWillMount starts timer after 30ms and sets state.clockStr', () => {
    expect(wrapper.state().clockStr).to.equal('');
    setTimeout(() => {
      expect(wrapper.state().clockStr).not.equal('');
    }, 31);
  });

  it('calls startTimer on mount', () => {
    const startTimerSpy = sinon.spy(Timer.prototype, 'startTimer');
    wrapper.mount();
    expect(Timer.prototype.startTimer.calledOnce);
    startTimerSpy.restore();
  });

  it('calls stopTimer on unmount', () => {
    const stopTimerSpy = sinon.spy(Timer.prototype, 'stopTimer');
    wrapper.unmount();
    expect(Timer.prototype.stopTimer.calledOnce);
    stopTimerSpy.restore();
  });

  it('renders a span with the correct class', () => {
    expect(wrapper.find('span').hasClass('label-warning')).to.equal(true);
  });
});
