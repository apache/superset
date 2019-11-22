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
import { FormControl, OverlayTrigger } from 'react-bootstrap';
import sinon from 'sinon';
import { shallow } from 'enzyme';

import TimeSeriesColumnControl from '../../../../src/explore/components/controls/TimeSeriesColumnControl';

const defaultProps = {
  name: 'x_axis_label',
  label: 'X Axis Label',
  onChange: sinon.spy(),
};

describe('SelectControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<TimeSeriesColumnControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders an OverlayTrigger', () => {
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders an Popover', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(FormControl)).toHaveLength(3);
  });
});
