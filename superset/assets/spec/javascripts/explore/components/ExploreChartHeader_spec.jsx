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

import ExploreChartHeader from '../../../../src/explore/components/ExploreChartHeader';
import ExploreActionButtons from '../../../../src/explore/components/ExploreActionButtons';
import EditableTitle from '../../../../src/components/EditableTitle';

const mockProps = {
  actions: {},
  can_overwrite: true,
  can_download: true,
  isStarred: true,
  slice: {},
  table_name: 'foo',
  form_data: {},
  timeout: 1000,
  chart: {
    queryResponse: {},
  },
};

describe('ExploreChartHeader', () => {
  let wrapper;
  beforeEach(() => {
    wrapper = shallow(<ExploreChartHeader {...mockProps} />);
  });

  it('is valid', () => {
    expect(
      React.isValidElement(<ExploreChartHeader {...mockProps} />),
    ).toBe(true);
  });

  it('renders', () => {
    expect(wrapper.find(EditableTitle)).toHaveLength(1);
    expect(wrapper.find(ExploreActionButtons)).toHaveLength(1);
  });
});
