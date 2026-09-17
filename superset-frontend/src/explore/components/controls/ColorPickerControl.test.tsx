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
import { render } from 'spec/helpers/testing-library';
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

  it('renders an OverlayTrigger', () => {
    const rendered = render(<ColorPickerControl {...defaultProps} />);

    // This is the div wrapping the OverlayTrigger and SketchPicker
    const controlWrapper = rendered.container.querySelectorAll('div')[1];
    expect(controlWrapper.childElementCount).toBe(2);

    // This is the div containing the OverlayTrigger
    const overlayTrigger = rendered.container.querySelectorAll('div')[2];
    expect(overlayTrigger).toHaveStyle(
      'position: absolute; width: 50px; height: 20px; top: 0px; left: 0px; right: 0px; bottom: 0px; background: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMUlEQVQ4T2NkYGAQYcAP3uCTZhw1gGGYhAGBZIA/nYDCgBDAm9BGDWAAJyRCgLaBCAAgXwixzAS0pgAAAABJRU5ErkJggg==) center;',
    );
  });

  it('renders a Popover with a SketchPicker', () => {
    const rendered = render(<ColorPickerControl {...defaultProps} />);

    // This is the div wrapping the OverlayTrigger and SketchPicker
    const controlWrapper = rendered.container.querySelectorAll('div')[1];
    expect(controlWrapper.childElementCount).toBe(2);

    // This is the div containing the SketchPicker
    const sketchPicker = rendered.container.querySelectorAll('div')[3];
    expect(sketchPicker).toHaveStyle(
      'position: absolute; width: 50px; height: 20px; top: 0px; left: 0px; right: 0px; bottom: 0px; border-radius: 2px;',
    );
  });
});
