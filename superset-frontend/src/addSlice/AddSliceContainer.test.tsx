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
import Button from 'src/components/Button';
import { Select } from 'src/components';
import AddSliceContainer, {
  AddSliceContainerProps,
  AddSliceContainerState,
} from 'src/addSlice/AddSliceContainer';
import VizTypeGallery from 'src/explore/components/controls/VizTypeControl/VizTypeGallery';
import { styledMount as mount } from 'spec/helpers/theming';
import { act } from 'spec/helpers/testing-library';

const datasource = {
  value: '1',
  label: 'table',
};

describe('AddSliceContainer', () => {
  let wrapper: ReactWrapper<
    AddSliceContainerProps,
    AddSliceContainerState,
    AddSliceContainer
  >;

  beforeEach(async () => {
    wrapper = mount(<AddSliceContainer />) as ReactWrapper<
      AddSliceContainerProps,
      AddSliceContainerState,
      AddSliceContainer
    >;
    // suppress a warning caused by some unusual async behavior in Icon
    await act(() => new Promise(resolve => setTimeout(resolve, 0)));
  });

  it('renders a select and a VizTypeControl', () => {
    expect(wrapper.find(Select)).toExist();
    expect(wrapper.find(VizTypeGallery)).toExist();
  });

  it('renders a button', () => {
    expect(wrapper.find(Button)).toExist();
  });

  it('renders a disabled button if no datasource is selected', () => {
    expect(
      wrapper.find(Button).find({ disabled: true }).hostNodes(),
    ).toHaveLength(1);
  });

  it('renders an enabled button if datasource and viz type is selected', () => {
    wrapper.setState({
      datasource,
      visType: 'table',
    });
    expect(
      wrapper.find(Button).find({ disabled: true }).hostNodes(),
    ).toHaveLength(0);
  });

  it('formats explore url', () => {
    wrapper.setState({
      datasource,
      visType: 'table',
    });
    const formattedUrl =
      '/superset/explore/?form_data=%7B%22viz_type%22%3A%22table%22%2C%22datasource%22%3A%221%22%7D';
    expect(wrapper.instance().exploreUrl()).toBe(formattedUrl);
  });
});
