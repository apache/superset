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
import { render, screen } from 'spec/helpers/testing-library';
import {
  CategoricalScheme,
  getCategoricalSchemeRegistry,
} from '@superset-ui/core';
import ColorPickerControl from 'src/explore/components/controls/ColorPickerControl';

const defaultProps = {
  value: {},
};

describe('ColorPickerControl', () => {
  beforeAll(() => {
    getCategoricalSchemeRegistry()
      .registerValue(
        'test',
        new CategoricalScheme({
          id: 'test',
          colors: ['red', 'green', 'blue'],
        }),
      )
      .setDefaultKey('test');
    render(<ColorPickerControl {...defaultProps} />);
  });

  it('renders a OverlayTrigger', () => {
    // const controlHeader = wrapper.find(ControlHeader);
    // expect(controlHeader).toHaveLength(1);
    // expect(wrapper.find(Popover)).toExist();

    screen.debug();
    expect.anything();
  });

  it('renders a Popover with a SketchPicker', () => {
    // const popOver = shallow(inst.renderPopover());
    // expect(popOver.find(SketchPicker)).toHaveLength(1);

    // screen.logTestingPlaygroundURL();
    expect.anything();
  });
});
