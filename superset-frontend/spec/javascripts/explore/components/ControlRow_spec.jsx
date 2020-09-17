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
import ControlSetRow from 'src/explore/components/ControlRow';

describe('ControlSetRow', () => {
  it('renders a single row with one element', () => {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    const wrapper = shallow(<ControlSetRow controls={[<a />]} />);
    expect(wrapper.find('.row')).toExist();
    expect(wrapper.find('.row').find('a')).toExist();
  });
  it('renders a single row with two elements', () => {
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    const wrapper = shallow(<ControlSetRow controls={[<a />, <a />]} />);
    expect(wrapper.find('.row')).toExist();
    expect(wrapper.find('.row').find('a')).toHaveLength(2);
  });
});
