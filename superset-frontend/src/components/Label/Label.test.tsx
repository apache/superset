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
import Label from '.';
import { LabelGallery, options } from './Label.stories';

describe('Label', () => {
  let wrapper: ReactWrapper;

  // test the basic component
  it('renders the base component (no onClick)', () => {
    expect(React.isValidElement(<Label />)).toBe(true);
  });

  it('works with an onClick handler', () => {
    const mockAction = jest.fn();
    wrapper = mount(<Label onClick={mockAction} />);
    wrapper.find(Label).simulate('click');
    expect(mockAction).toHaveBeenCalled();
  });

  // test stories from the storybook!
  it('renders all the storybook gallery variants', () => {
    wrapper = mount(<LabelGallery />);
    expect(wrapper.find(Label).length).toEqual(options.length * 2);
  });
});
