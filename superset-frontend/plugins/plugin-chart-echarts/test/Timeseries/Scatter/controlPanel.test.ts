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
import { ControlPanelsContainerProps } from '@superset-ui/chart-controls';
import { GenericDataType } from '@superset-ui/core';
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
  typeGeneric: GenericDataType | null,
): ControlPanelsContainerProps => {
  const columns =
    xAxisColumn && typeGeneric !== null
      ? [{ column_name: xAxisColumn, type_generic: typeGeneric }]
      : [];

  return {
    controls: {
      // @ts-ignore
      x_axis: {
        value: xAxisColumn,
      },
      // @ts-expect-error
      datasource: {
        datasource: { columns },
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
const numberFormatControl: any = getControl('x_axis_number_format');

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
