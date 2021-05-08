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
import sinon from 'sinon';
import { styledMount as mount } from 'spec/helpers/theming';
import BoundsControl from 'src/explore/components/controls/BoundsControl';
import { Input } from 'src/common/components';

const defaultProps = {
  name: 'y_axis_bounds',
  label: 'Bounds of the y axis',
  onChange: sinon.spy(),
};

describe('BoundsControl', () => {
  let wrapper;

  beforeEach(() => {
    wrapper = mount(<BoundsControl {...defaultProps} />);
  });

  it('renders two Input', () => {
    expect(wrapper.find(Input)).toHaveLength(2);
  });

  it('errors on non-numeric', () => {
    wrapper
      .find(Input)
      .first()
      .simulate('change', { target: { value: 's' } });
    expect(defaultProps.onChange.calledWith([null, null])).toBe(true);
    expect(defaultProps.onChange.getCall(0).args[1][0]).toContain(
      'value should be numeric',
    );
  });
  it('casts to numeric', () => {
    wrapper
      .find(Input)
      .first()
      .simulate('change', { target: { value: '1' } });
    wrapper
      .find(Input)
      .last()
      .simulate('change', { target: { value: '5' } });
    expect(defaultProps.onChange.calledWith([1, 5])).toBe(true);
  });
});
