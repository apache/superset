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
import { shallow } from 'enzyme';
import { Tooltip } from '../../src/components/Tooltip';
import { InfoTooltipWithTrigger } from '../../src';

describe('InfoTooltipWithTrigger', () => {
  it('renders a tooltip', () => {
    const wrapper = shallow(
      <InfoTooltipWithTrigger label="test" tooltip="this is a test" />,
    );
    expect(wrapper.find(Tooltip)).toHaveLength(1);
  });

  it('renders an info icon', () => {
    const wrapper = shallow(<InfoTooltipWithTrigger />);
    expect(wrapper.find('.fa-info-circle')).toHaveLength(1);
  });

  it('responds to keypresses', () => {
    const clickHandler = jest.fn();
    const wrapper = shallow(
      <InfoTooltipWithTrigger
        label="test"
        tooltip="this is a test"
        onClick={clickHandler}
      />,
    );
    wrapper.find('.fa-info-circle').simulate('keypress', { key: 'Tab' });
    expect(clickHandler).toHaveBeenCalledTimes(0);
    wrapper.find('.fa-info-circle').simulate('keypress', { key: 'Enter' });
    expect(clickHandler).toHaveBeenCalledTimes(1);
    wrapper.find('.fa-info-circle').simulate('keypress', { key: ' ' });
    expect(clickHandler).toHaveBeenCalledTimes(2);
  });

  it('has a bsStyle', () => {
    const wrapper = shallow(<InfoTooltipWithTrigger bsStyle="something" />);
    expect(wrapper.find('.text-something')).toHaveLength(1);
  });
});
