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
import { styledMount as mount } from 'spec/helpers/theming';
import Button from '.';
import {
  ButtonGallery,
  SIZES as buttonSizes,
  STYLES as buttonStyles,
} from './Button.stories';

describe('Button', () => {
  let wrapper: ReactWrapper;

  // test the basic component
  it('renders the base component', () => {
    expect(React.isValidElement(<Button />)).toBe(true);
  });

  it('works with an onClick handler', () => {
    const mockAction = jest.fn();
    wrapper = mount(<Button onClick={mockAction} />);
    wrapper.find('Button').first().simulate('click');
    expect(mockAction).toHaveBeenCalled();
  });

  it('does not handle onClicks when disabled', () => {
    const mockAction = jest.fn();
    wrapper = mount(<Button onClick={mockAction} disabled />);
    wrapper.find('Button').first().simulate('click');
    expect(mockAction).toHaveBeenCalledTimes(0);
  });

  // test stories from the storybook!
  it('All the sorybook gallery variants mount', () => {
    wrapper = mount(<ButtonGallery />);

    const permutationCount =
      Object.values(buttonStyles.options).filter(o => o).length *
      Object.values(buttonSizes.options).length;

    expect(wrapper.find(Button).length).toEqual(permutationCount);
  });

  // test things NOT in the storybook!
  it('renders custom button styles without melting', () => {
    wrapper = mount(<Button buttonStyle="foobar" />);
    expect(wrapper.find('Button.btn-foobar')).toHaveLength(1);
  });
});
