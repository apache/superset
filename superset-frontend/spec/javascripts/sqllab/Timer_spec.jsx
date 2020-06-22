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
import React from 'react';
import { mount } from 'enzyme';
import sinon from 'sinon';

import Timer from 'src/components/Timer';
import { now } from 'src/modules/dates';

describe('Timer', () => {
  let wrapper;
  const mockedProps = {
    endTime: null,
    isRunning: true,
    status: 'warning',
  };

  beforeEach(() => {
    mockedProps.startTime = now() + 1;
    wrapper = mount(<Timer {...mockedProps} />);
  });

  it('is a valid element', () => {
    expect(React.isValidElement(<Timer {...mockedProps} />)).toBe(true);
  });

  it('componentWillMount starts timer after 30ms and sets state.clockStr', async () => {
    expect(wrapper.state().clockStr).toBe('');
    await new Promise(r => setTimeout(r, 35));
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
