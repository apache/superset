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
import { ControlPanelsContainerProps } from '@superset-ui/chart-controls/types';
import { GenericDataType } from '@apache-superset/core/common';
import controlPanel from '../../../src/Timeseries/Regular/Scatter/controlPanel';
import { getControl, mockControls } from '../helpers';

const config = controlPanel;

// tests for x_axis_time_format control
const timeFormatControl = getControl(config, 'x_axis_time_format')!;

test('scatter chart control panel should include x_axis_time_format control in the panel', () => {
  expect(timeFormatControl).toBeDefined();
});

test('scatter chart control panel should have correct default value for x_axis_time_format', () => {
  expect(timeFormatControl).toBeDefined();
  expect(timeFormatControl.config).toBeDefined();
  expect(timeFormatControl.config.default).toBe('smart_date');
});

test('scatter chart control panel should have visibility function for x_axis_time_format', () => {
  expect(timeFormatControl).toBeDefined();
  expect(timeFormatControl.config.visibility).toBeDefined();
  expect(typeof timeFormatControl.config.visibility).toBe('function');

  // The visibility function exists - the exact logic is tested implicitly through UI behavior
  // The important part is that the control has proper visibility configuration
});

const isTimeVisible = (
  xAxisColumn: string | null,
  xAxisType: GenericDataType | null,
): boolean => {
  const props = mockControls(xAxisColumn, xAxisType);
  const visibilityFn = timeFormatControl?.config?.visibility;
  return visibilityFn ? visibilityFn(props) : false;
};

test('x_axis_time_format control should be visible for temporal data types', () => {
  expect(isTimeVisible('time_column', GenericDataType.Temporal)).toBe(true);
});

test('x_axis_time_format control should be hidden for non-temporal data types', () => {
  expect(isTimeVisible(null, null)).toBe(false);
  expect(isTimeVisible('float_column', GenericDataType.Numeric)).toBe(false);
  expect(isTimeVisible('name_column', GenericDataType.String)).toBe(false);
});

// tests for x_axis_number_format control
const numberFormatControl = getControl(config, 'x_axis_number_format')!;

test('scatter chart control panel should include x_axis_number_format control in the panel', () => {
  expect(numberFormatControl).toBeDefined();
});

test('scatter chart control panel should have correct default value for x_axis_number_format', () => {
  expect(numberFormatControl).toBeDefined();
  expect(numberFormatControl.config).toBeDefined();
  expect(numberFormatControl.config.default).toBe('~g');
});

test('scatter chart control panel should have visibility function for x_axis_number_format', () => {
  expect(numberFormatControl).toBeDefined();
  expect(numberFormatControl.config.visibility).toBeDefined();
  expect(typeof numberFormatControl.config.visibility).toBe('function');

  // The visibility function exists - the exact logic is tested implicitly through UI behavior
  // The important part is that the control has proper visibility configuration
});

const isNumberVisible = (
  xAxisColumn: string | null,
  xAxisType: GenericDataType | null,
): boolean => {
  const props = mockControls(xAxisColumn, xAxisType);
  const visibilityFn = numberFormatControl?.config?.visibility;
  return visibilityFn ? visibilityFn(props) : false;
};

test('x_axis_number_format control should be visible for numeric data types', () => {
  expect(isNumberVisible('float_column', GenericDataType.Numeric)).toBe(true);
  expect(isNumberVisible('int_column', GenericDataType.Numeric)).toBe(true);
});

test('x_axis_number_format control should be hidden for non-numeric data types', () => {
  expect(isNumberVisible('string_column', GenericDataType.String)).toBe(false);
  expect(isNumberVisible(null, null)).toBe(false);
  expect(isNumberVisible('time_column', GenericDataType.Temporal)).toBe(false);
});

// tests for orientation and dot size controls
const orientationControl = getControl(config, 'orientation')!;
const sizeControl = getControl(config, 'size')!;
const minMarkerSizeControl = getControl(config, 'minMarkerSize')!;
const maxMarkerSizeControl = getControl(config, 'maxMarkerSize')!;

test('scatter chart control panel should include an orientation control defaulting to vertical', () => {
  expect(orientationControl).toBeDefined();
  expect(orientationControl.config.default).toBe('vertical');
  expect(orientationControl.config.options).toEqual([
    ['vertical', expect.anything()],
    ['horizontal', expect.anything()],
  ]);
});

test('scatter chart control panel should include an optional dot size metric control', () => {
  expect(sizeControl).toBeDefined();
  expect(sizeControl.config.validators).toEqual([]);
  expect(sizeControl.config.default).toBeNull();
});

const mockSizeControls = (
  sizeValue: string | null,
): ControlPanelsContainerProps =>
  ({
    controls: {
      size: { value: sizeValue },
      markerEnabled: { value: true },
    },
  }) as unknown as ControlPanelsContainerProps;

test('dot size range controls should only be visible when a size metric is set', () => {
  expect(minMarkerSizeControl.config.visibility(mockSizeControls(null))).toBe(
    false,
  );
  expect(maxMarkerSizeControl.config.visibility(mockSizeControls(null))).toBe(
    false,
  );
  expect(
    minMarkerSizeControl.config.visibility(mockSizeControls('size_metric')),
  ).toBe(true);
  expect(
    maxMarkerSizeControl.config.visibility(mockSizeControls('size_metric')),
  ).toBe(true);
});

test('fixed marker size control should hide when a size metric is set', () => {
  const markerSizeControl = getControl(config, 'markerSize')!;
  expect(markerSizeControl.config.visibility(mockSizeControls(null))).toBe(
    true,
  );
  expect(
    markerSizeControl.config.visibility(mockSizeControls('size_metric')),
  ).toBe(false);
});
