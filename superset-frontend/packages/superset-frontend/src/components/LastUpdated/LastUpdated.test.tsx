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
import LastUpdated from '.';

describe('LastUpdated', () => {
  let wrapper: ReactWrapper;
  const updatedAt = new Date('Sat Dec 12 2020 00:00:00 GMT-0800');

  it('renders the base component (no refresh)', () => {
    const wrapper = mount(<LastUpdated updatedAt={updatedAt} />);
    expect(/^Last Updated .+$/.test(wrapper.text())).toBe(true);
  });

  it('renders a refresh action', () => {
    const mockAction = jest.fn();
    wrapper = mount(<LastUpdated updatedAt={updatedAt} update={mockAction} />);
    const props = wrapper.find('[data-test="refresh"]').props();
    if (props.onClick) {
      props.onClick({} as React.MouseEvent);
    }
    expect(mockAction).toHaveBeenCalled();
  });
});
