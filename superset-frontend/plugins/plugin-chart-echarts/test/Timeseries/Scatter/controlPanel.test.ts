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
import controlPanel from '../../../src/Timeseries/Regular/Scatter/controlPanel';

const config = controlPanel;

const getControl = (controlName: string) => {
  for (const section of config.controlPanelSections) {
    if (section && section.controlSetRows) {
      for (const row of section.controlSetRows) {
        for (const control of row) {
          if (
            typeof control === 'object' &&
            control !== null &&
            'name' in control &&
            control.name === controlName
          ) {
            return control;
          }
        }
      }
    }
  }

  return null;
};

const mockControls = (
  xAxisColumn: string | null,
  xAxisType: string | null,
): ControlPanelsContainerProps => {
  const options = xAxisType
    ? [{ column_name: xAxisColumn, type: xAxisType }]
    : [];

  return {
    controls: {
      // @ts-ignore
      x_axis: {
        value: xAxisColumn,
        options: options,
      },
    },
  };
};

// tests for x_axis_time_format control
const timeFormatControl: any = getControl('x_axis_time_format');

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
  xAxisType: string | null,
): boolean => {
  const props = mockControls(xAxisColumn, xAxisType);
  const visibilityFn = timeFormatControl?.config?.visibility;
  return visibilityFn ? visibilityFn(props) : false;
};

test('x_axis_time_format control should be visible for any data types include TIME', () => {
  expect(isTimeVisible('time_column', 'TIME')).toBe(true);
  expect(isTimeVisible('time_column', 'TIME WITH TIME ZONE')).toBe(true);
  expect(isTimeVisible('time_column', 'TIMESTAMP WITH TIME ZONE')).toBe(true);
  expect(isTimeVisible('time_column', 'TIMESTAMP WITHOUT TIME ZONE')).toBe(
    true,
  );
});

test('x_axis_time_format control should be hidden for data types that do NOT include TIME', () => {
  expect(isTimeVisible('null', 'null')).toBe(false);
  expect(isTimeVisible(null, null)).toBe(false);
  expect(isTimeVisible('float_column', 'FLOAT')).toBe(false);
});

// tests for x_axis_number_format control
const numberFormatControl: any = getControl('x_axis_number_format');

test('scatter chart control panel should include x_axis_number_format control in the panel', () => {
  expect(numberFormatControl).toBeDefined();
});

test('scatter chart control panel should have correct default value for x_axis_number_format', () => {
  expect(numberFormatControl).toBeDefined();
  expect(numberFormatControl.config).toBeDefined();
  expect(numberFormatControl.config.default).toBe('SMART_NUMBER');
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
  xAxisType: string | null,
): boolean => {
  const props = mockControls(xAxisColumn, xAxisType);
  const visibilityFn = numberFormatControl?.config?.visibility;
  return visibilityFn ? visibilityFn(props) : false;
};

test('x_axis_number_format control should be visible for any floating-point data types', () => {
  expect(isNumberVisible('float_column', 'FLOAT')).toBe(true);
  expect(isNumberVisible('double_column', 'DOUBLE')).toBe(true);
  expect(isNumberVisible('real_column', 'REAL')).toBe(true);
  expect(isNumberVisible('numeric_column', 'NUMERIC')).toBe(true);
  expect(isNumberVisible('decimal_column', 'DECIMAL')).toBe(true);
});

test('x_axis_number_format control should be hidden for any non-floating-point data types', () => {
  expect(isNumberVisible('string_column', 'VARCHAR')).toBe(false);
  expect(isNumberVisible('null', 'null')).toBe(false);
  expect(isNumberVisible(null, null)).toBe(false);
  expect(isNumberVisible('time_column', 'TIMESTAMP WITHOUT TIME ZONE')).toBe(
    false,
  );
});
