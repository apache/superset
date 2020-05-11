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

import { ExploreChartHeader } from 'src/explore/components/ExploreChartHeader';
import ExploreActionButtons from 'src/explore/components/ExploreActionButtons';
import EditableTitle from 'src/components/EditableTitle';

const stub = jest.fn(() => ({
  then: () => {},
}));
const mockProps = {
  actions: {
    saveSlice: stub,
  },
  can_overwrite: true,
  can_download: true,
  isStarred: true,
  slice: {
    form_data: {
      viz_type: 'line',
    },
  },
  table_name: 'foo',
  form_data: {
    viz_type: 'table',
  },
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
    expect(React.isValidElement(<ExploreChartHeader {...mockProps} />)).toBe(
      true,
    );
  });

  it('renders', () => {
    expect(wrapper.find(EditableTitle)).toHaveLength(1);
    expect(wrapper.find(ExploreActionButtons)).toHaveLength(1);
  });

  it('should updateChartTitleOrSaveSlice for existed slice', () => {
    const newTitle = 'New Chart Title';
    wrapper.instance().updateChartTitleOrSaveSlice(newTitle);
    expect(stub.call).toHaveLength(1);
    expect(stub).toHaveBeenCalledWith(mockProps.slice.form_data, {
      action: 'overwrite',
      slice_name: newTitle,
    });
  });

  it('should updateChartTitleOrSaveSlice for new slice', () => {
    const newTitle = 'New Chart Title';
    wrapper.setProps({ slice: undefined });
    wrapper.instance().updateChartTitleOrSaveSlice(newTitle);
    expect(stub.call).toHaveLength(1);
    expect(stub).toHaveBeenCalledWith(mockProps.form_data, {
      action: 'saveas',
      slice_name: newTitle,
    });
  });
});
