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

import React from 'react';
import { shallow } from 'enzyme';
import { ChartFrame } from '@superset-ui/core';

describe('TooltipFrame', () => {
  it('renders content that requires smaller space than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={300}
        contentHeight={300}
        renderContent={({ width, height }) => (
          <div>
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div').text()).toEqual('400/400');
  });

  it('renders content without specifying content size', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        renderContent={({ width, height }) => (
          <div>
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div').text()).toEqual('400/400');
  });

  it('renders content that requires same size with frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={400}
        contentHeight={400}
        renderContent={({ width, height }) => (
          <div>
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div').text()).toEqual('400/400');
  });

  it('renders content that requires space larger than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={500}
        contentHeight={500}
        renderContent={({ width, height }) => (
          <div className="chart">
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div.chart').text()).toEqual('500/500');
  });

  it('renders content that width is larger than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentWidth={500}
        renderContent={({ width, height }) => (
          <div className="chart">
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div.chart').text()).toEqual('500/400');
  });

  it('renders content that height is larger than frame', () => {
    const wrapper = shallow(
      <ChartFrame
        width={400}
        height={400}
        contentHeight={600}
        renderContent={({ width, height }) => (
          <div className="chart">
            {width}/{height}
          </div>
        )}
      />,
    );
    expect(wrapper.find('div.chart').text()).toEqual('400/600');
  });

  it('renders an empty frame when renderContent is not given', () => {
    const wrapper = shallow(<ChartFrame width={400} height={400} />);
    expect(wrapper.find('div')).toHaveLength(0);
  });
});
