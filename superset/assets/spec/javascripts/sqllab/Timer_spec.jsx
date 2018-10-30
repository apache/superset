import React from 'react';
import { mount } from 'enzyme';
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
    expect(React.isValidElement(<Timer {...mockedProps} />)).toBe(true);
  });

  it('componentWillMount starts timer after 30ms and sets state.clockStr', () => {
    expect(wrapper.state().clockStr).toBe('');
    clock.tick(31);
    expect(wrapper.state().clockStr).not.toBe('');
  });

  it('calls startTimer on mount', () => {
    // Timer is already mounted in beforeEach
    wrapper.unmount();
    const startTimerSpy = sinon.spy(Timer.prototype, 'startTimer');
    wrapper.mount();
    // Timer is started once in willUnmount and a second timer in render
    // TODO: Questionable whether this is necessary.
    expect(startTimerSpy.callCount).toBe(2);
    startTimerSpy.restore();
  });

  it('calls stopTimer on unmount', () => {
    const stopTimerSpy = sinon.spy(Timer.prototype, 'stopTimer');
    wrapper.unmount();
    expect(stopTimerSpy.callCount).toBe(1);
    stopTimerSpy.restore();
  });

  it('renders a span with the correct class', () => {
    expect(wrapper.find('span').hasClass('label-warning')).toBe(true);
  });
});
