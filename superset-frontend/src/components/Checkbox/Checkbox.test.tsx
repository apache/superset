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
import { ReactWrapper } from 'enzyme';
import {
  styledMount as mount,
  styledShallow as shallow,
} from 'spec/helpers/theming';

import Checkbox from '.';
import { CheckboxChecked, CheckboxUnchecked } from '../CheckboxIcons';

describe('Checkbox', () => {
  let wrapper: ReactWrapper;

  it('renders the base component', () => {
    expect(
      React.isValidElement(
        <Checkbox style={{}} checked={false} onChange={() => true} />,
      ),
    ).toBe(true);
  });

  describe('when unchecked', () => {
    it('renders the unchecked component', () => {
      const shallowWrapper = shallow(
        <Checkbox style={{}} checked={false} onChange={() => true} />,
      );
      expect(shallowWrapper.dive().dive().find(CheckboxUnchecked)).toExist();
    });
  });

  describe('when checked', () => {
    it('renders the checked component', () => {
      const shallowWrapper = shallow(
        <Checkbox style={{}} checked onChange={() => true} />,
      );
      expect(shallowWrapper.dive().dive().find(CheckboxChecked)).toExist();
    });
  });

  it('works with an onChange handler', () => {
    const mockAction = jest.fn();
    wrapper = mount(
      <Checkbox style={{}} checked={false} onChange={mockAction} />,
    );
    wrapper.find('Checkbox').first().simulate('click');
    expect(mockAction).toHaveBeenCalled();
  });

  it('renders custom Checkbox styles without melting', () => {
    wrapper = mount(
      <Checkbox onChange={() => true} checked={false} style={{ opacity: 1 }} />,
    );
    expect(wrapper.find('Checkbox')).toExist();
    expect(wrapper.find('Checkbox')).toHaveStyle({ opacity: 1 });
  });
});
