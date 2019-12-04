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
import { OverlayTrigger, Label } from 'react-bootstrap';

import ViewportControl from '../../../../src/explore/components/controls/ViewportControl';
import TextControl from '../../../../src/explore/components/controls/TextControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

const defaultProps = {
  value: {
    longitude: 6.85236157047845,
    latitude: 31.222656842808707,
    zoom: 1,
    bearing: 0,
    pitch: 0,
  },
};

describe('ViewportControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    wrapper = shallow(<ViewportControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders a Popover with 5 TextControl', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(TextControl)).toHaveLength(5);
  });

  it('renders a summary in the label', () => {
    expect(
      wrapper
        .find(Label)
        .first()
        .render()
        .text(),
    ).toBe('6° 51\' 8.50" | 31° 13\' 21.56"');
  });
});
