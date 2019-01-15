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
/* eslint-disable no-unused-expressions */
import React from 'react';
import { shallow } from 'enzyme';
import { OverlayTrigger } from 'react-bootstrap';

import FixedOrMetricControl from
  '../../../../src/explore/components/controls/FixedOrMetricControl';
import TextControl from
  '../../../../src/explore/components/controls/TextControl';
import MetricsControl from
  '../../../../src/explore/components/controls/MetricsControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

const defaultProps = {
  value: { },
};

describe('FixedOrMetricControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<FixedOrMetricControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders a TextControl and a SelectControl', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(TextControl)).toHaveLength(1);
    expect(popOver.find(MetricsControl)).toHaveLength(1);
  });
});
