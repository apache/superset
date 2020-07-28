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
<<<<<<< HEAD
import { shallow } from 'enzyme';
=======
import sinon from 'sinon';
import { shallow, mount } from 'enzyme';
>>>>>>> update tests lint errors

import Checkbox from 'src/components/IndeterminateCheckbox';

describe('Checkbox', () => {
  const defaultProps = {
    title: 'check',
    checked: true,
  };

  let wrapper;
  const factory = o => {
    const props = { ...defaultProps, ...o };
    return shallow(<Checkbox {...props} />);
  };
  beforeEach(() => {
    wrapper = factory({});
  });
  it('is a valid element', () => {
    expect(React.isValidElement(<Checkbox {...defaultProps} />)).toBe(true);
  });
  it('inits checked when checked', () => {
    const icon = wrapper.find('Icon');
    expect(icon.props()).toEqual({ name: 'checkbox-on' });
  });
  it('inits unchecked when not checked', () => {
    const el = factory({ checked: false });
    const icon = el.find('Icon');
    expect(icon.props()).toEqual({ name: 'checkbox-off' });
  });
});
