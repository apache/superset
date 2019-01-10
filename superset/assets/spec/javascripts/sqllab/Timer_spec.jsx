import React from 'react';
import { mount } from 'enzyme';
import { expect } from 'chai';
import sinon from 'sinon';

import Timer from '../../../src/components/Timer';
import { now } from '../../../src/modules/dates';


describe('Timer', () => {
  let wrapper;
  let clock;
  const mockedProps = {
    endTime: null,
    isRunning: true,
    status: 'warning',
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers();
    mockedProps.startTime = now() + 1;
    wrapper = mount(<Timer {...mockedProps} />);
  });
  afterEach(() => {
    clock.restore();
  });

  it('is a valid element', () => {
    expect(React.isValidElement(<Timer {...mockedProps} />)).to.equal(true);
  });

  it('componentWillMount starts timer after 30ms and sets state.clockStr', () => {
    expect(wrapper.state().clockStr).to.equal('');
    clock.tick(31);
    expect(wrapper.state().clockStr).not.equal('');
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
