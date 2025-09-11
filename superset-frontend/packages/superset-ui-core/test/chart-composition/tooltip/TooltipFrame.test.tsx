/*
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

import { shallow } from 'enzyme';
import { TooltipFrame } from '@superset-ui/core';

describe('TooltipFrame', () => {
  it('sets className', () => {
    const wrapper = shallow(
      <TooltipFrame className="test-class">
        <span>Hi!</span>
      </TooltipFrame>,
    );
    expect(wrapper.hasClass('test-class')).toEqual(true);
  });

  it('renders', () => {
    const wrapper = shallow(
      <TooltipFrame>
        <span>Hi!</span>
      </TooltipFrame>,
    );
    const span = wrapper.find('span');
    expect(span).toHaveLength(1);
    expect(span.text()).toEqual('Hi!');
  });
});
