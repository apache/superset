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
import { styledMount as mount } from 'spec/helpers/theming';
import Security from 'src/profile/components/Security';

import { user, userNoPerms } from './fixtures';

describe('Security', () => {
  const mockedProps = {
    user,
  };
  it('is valid', () => {
    expect(React.isValidElement(<Security {...mockedProps} />)).toBe(true);
  });
  it('renders 2 role labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.roles').find('.label')).toHaveLength(2);
  });
  it('renders 2 datasource labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.datasources').find('.label')).toHaveLength(2);
  });
  it('renders 3 database labels', () => {
    const wrapper = mount(<Security {...mockedProps} />);
    expect(wrapper.find('.databases').find('.label')).toHaveLength(3);
  });
  it('renders no permission label when empty', () => {
    const wrapper = mount(<Security user={userNoPerms} />);
    expect(wrapper.find('.datasources').find('.label')).not.toExist();
    expect(wrapper.find('.databases').find('.label')).not.toExist();
  });
});
