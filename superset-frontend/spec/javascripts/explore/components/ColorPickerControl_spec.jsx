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
import { SketchPicker } from 'react-color';
import {
  CategoricalScheme,
  getCategoricalSchemeRegistry,
} from '@superset-ui/color';

import ColorPickerControl from '../../../../src/explore/components/controls/ColorPickerControl';
import ControlHeader from '../../../../src/explore/components/ControlHeader';

const defaultProps = {
  value: {},
};

describe('ColorPickerControl', () => {
  let wrapper;
  let inst;
  beforeEach(() => {
    getCategoricalSchemeRegistry()
      .registerValue(
        'test',
        new CategoricalScheme({
          id: 'test',
          colors: ['red', 'green', 'blue'],
        }),
      )
      .setDefaultKey('test');
    wrapper = shallow(<ColorPickerControl {...defaultProps} />);
    inst = wrapper.instance();
  });

  it('renders a OverlayTrigger', () => {
    const controlHeader = wrapper.find(ControlHeader);
    expect(controlHeader).toHaveLength(1);
    expect(wrapper.find(OverlayTrigger)).toHaveLength(1);
  });

  it('renders a Popover with a SketchPicker', () => {
    const popOver = shallow(inst.renderPopover());
    expect(popOver.find(SketchPicker)).toHaveLength(1);
  });
});
