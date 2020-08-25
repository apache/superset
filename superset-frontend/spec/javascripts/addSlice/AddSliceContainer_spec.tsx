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
import { shallow, ShallowWrapper } from 'enzyme';
import Button from 'src/components/Button';
import Select from 'src/components/Select';
import AddSliceContainer, {
  AddSliceContainerProps,
  AddSliceContainerState,
} from 'src/addSlice/AddSliceContainer';
import VizTypeControl from 'src/explore/components/controls/VizTypeControl';

const defaultProps = {
  datasources: [
    { label: 'my first table', value: '1__table' },
    { label: 'another great table', value: '2__table' },
  ],
};

describe('AddSliceContainer', () => {
  let wrapper: ShallowWrapper<
    AddSliceContainerProps,
    AddSliceContainerState,
    AddSliceContainer
  >;

  beforeEach(() => {
    wrapper = shallow(<AddSliceContainer {...defaultProps} />);
  });

  it('uses table as default visType', () => {
    expect(wrapper.state().visType).toBe('table');
  });

  it('renders a select and a VizTypeControl', () => {
    expect(wrapper.find(Select)).toExist();
    expect(wrapper.find(VizTypeControl)).toExist();
  });

  it('renders a button', () => {
    expect(wrapper.find(Button)).toExist();
  });

  it('renders a disabled button if no datasource is selected', () => {
    expect(wrapper.find(Button).dive().find({ disabled: true })).toHaveLength(
      1,
    );
  });

  it('renders an enabled button if datasource is selected', () => {
    const datasourceValue = defaultProps.datasources[0].value;
    wrapper.setState({
      datasourceValue,
      datasourceId: datasourceValue.split('__')[0],
      datasourceType: datasourceValue.split('__')[1],
    });
    expect(wrapper.find(Button).dive().find({ disabled: true })).toHaveLength(
      0,
    );
  });

  it('formats explore url', () => {
    const datasourceValue = defaultProps.datasources[0].value;
    wrapper.setState({
      datasourceValue,
      datasourceId: datasourceValue.split('__')[0],
      datasourceType: datasourceValue.split('__')[1],
    });
    const formattedUrl =
      '/superset/explore/?form_data=%7B%22viz_type%22%3A%22table%22%2C%22datasource%22%3A%221__table%22%7D';
    expect(wrapper.instance().exploreUrl()).toBe(formattedUrl);
  });
});
