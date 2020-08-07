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
import { styledMount as mount } from 'spec/helpers/theming';
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

  it('useEffect starts timer after 30ms and sets state of clockStr', async () => {
    expect(wrapper.find('span').text()).toBe('');
    await new Promise(r => setTimeout(r, 35));
    expect(wrapper.find('span').text()).not.toBe('');
  });

  it('renders a span with the correct class', () => {
    expect(wrapper.find('span').hasClass('label-warning')).toBe(true);
  });
});
