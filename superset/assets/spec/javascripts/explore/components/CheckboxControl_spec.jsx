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
/* eslint-disable no-unused-expressions */
import React from 'react';
import sinon from 'sinon';
import { shallow, mount } from 'enzyme';

import CheckboxControl from '../../../../src/explore/components/controls/CheckboxControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';
import Checkbox from '../../../../src/components/Checkbox';

const defaultProps = {
  name: 'show_legend',
  onChange: sinon.spy(),
  value: false,
  label: 'checkbox label',
};

describe('CheckboxControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = shallow(<CheckboxControl {...defaultProps} />);
  });

  it('renders a Checkbox', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);

    const headerWrapper = controlHeader.shallow();
    expect(headerWrapper.find(Checkbox)).toHaveLength(1);
  });

  it('Checks the box when the label is clicked', () => {
    const fullComponent = mount(<CheckboxControl {...defaultProps} />);

    const spy = sinon.spy(fullComponent.instance(), 'onChange');

    fullComponent.instance().forceUpdate();

    fullComponent
      .find('label span')
      .last()
      .simulate('click');

    expect(spy.calledOnce).toBe(true);
  });
});
