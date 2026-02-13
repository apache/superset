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
import controlPanel from '../../../src/Timeseries/Regular/Bar/controlPanel';
import {
  StackControlOptionsWithoutStream,
  StackControlsValue,
} from '../../../src/constants';

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

// Mock getStandardizedControls
jest.mock('@superset-ui/chart-controls', () => {
  const actual = jest.requireActual('@superset-ui/chart-controls');
  return {
    ...actual,
    getStandardizedControls: jest.fn(() => ({
      popAllMetrics: jest.fn(() => []),
      popAllColumns: jest.fn(() => []),
    })),
  };
});

test('should include x_axis_time_format control in the panel', () => {
  const timeFormatControl = getControl('x_axis_time_format');
  expect(timeFormatControl).toBeDefined();
});

test('should have correct default value for x_axis_time_format', () => {
  const timeFormatControl: any = getControl('x_axis_time_format');
  expect(timeFormatControl).toBeDefined();
  expect(timeFormatControl.config).toBeDefined();
  expect(timeFormatControl.config.default).toBe('smart_date');
});

test('should have visibility function for x_axis_time_format', () => {
  const timeFormatControl: any = getControl('x_axis_time_format');
  expect(timeFormatControl).toBeDefined();
  expect(timeFormatControl.config.visibility).toBeDefined();
  expect(typeof timeFormatControl.config.visibility).toBe('function');
});

test('should have proper control configuration for x_axis_time_format', () => {
  const timeFormatControl: any = getControl('x_axis_time_format');
  expect(timeFormatControl).toBeDefined();
  expect(timeFormatControl.config).toMatchObject({
    default: 'smart_date',
    disableStash: true,
    resetOnHide: false,
  });
  expect(timeFormatControl.config.description).toContain('D3');
});

test('should have Chart Orientation section', () => {
  const orientationSection = config.controlPanelSections.find(
    section => section && section.label === 'Chart Orientation',
  );
  expect(orientationSection).toBeDefined();
  expect(orientationSection!.expanded).toBe(true);
});

test('should have Chart Options section with X Axis controls', () => {
  const chartOptionsSection = config.controlPanelSections.find(
    section => section && section.label === 'Chart Options',
  );
  expect(chartOptionsSection).toBeDefined();
  expect(chartOptionsSection!.expanded).toBe(true);
  expect(chartOptionsSection!.controlSetRows).toBeDefined();
  expect(chartOptionsSection!.controlSetRows!.length).toBeGreaterThan(0);
});

test('should have proper form data overrides', () => {
  expect(config.formDataOverrides).toBeDefined();
  expect(typeof config.formDataOverrides).toBe('function');

  const mockFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    metrics: ['test_metric'],
    groupby: ['test_column'],
    other_field: 'test',
  };

  const result = config.formDataOverrides!(mockFormData);

  expect(result).toHaveProperty('metrics');
  expect(result).toHaveProperty('groupby');
  expect(result).toHaveProperty('other_field', 'test');
});

test('should include stack control in the panel', () => {
  const stackControl = getControl('stack');
  expect(stackControl).toBeDefined();
});

test('should use StackControlOptionsWithoutStream for stack control', () => {
  const stackControl: any = getControl('stack');
  expect(stackControl).toBeDefined();
  expect(stackControl.config).toBeDefined();
  expect(stackControl.config.choices).toBe(StackControlOptionsWithoutStream);
});

test('should not include Stream option in stack control choices', () => {
  const stackControl: any = getControl('stack');
  expect(stackControl).toBeDefined();
  const { choices } = stackControl.config;
  const streamOption = choices.find(
    (choice: any[]) => choice[0] === StackControlsValue.Stream,
  );
  expect(streamOption).toBeUndefined();
});

test('should include None and Stack options in stack control choices', () => {
  const stackControl: any = getControl('stack');
  expect(stackControl).toBeDefined();
  const { choices } = stackControl.config;
  const noneOption = choices.find((choice: any[]) => choice[0] === null);
  const stackOption = choices.find(
    (choice: any[]) => choice[0] === StackControlsValue.Stack,
  );
  expect(noneOption).toBeDefined();
  expect(stackOption).toBeDefined();
});

test('should have correct default value for stack control', () => {
  const stackControl: any = getControl('stack');
  expect(stackControl).toBeDefined();
  expect(stackControl.config.default).toBe(null);
});

test('should reset stack to null when formData has Stream value', () => {
  const mockFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    metrics: ['test_metric'],
    groupby: ['test_column'],
    stack: StackControlsValue.Stream,
  };

  const result = config.formDataOverrides!(mockFormData);

  expect(result.stack).toBe(null);
});

test('should preserve stack value when formData has Stack value', () => {
  const mockFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    metrics: ['test_metric'],
    groupby: ['test_column'],
    stack: StackControlsValue.Stack,
  };

  const result = config.formDataOverrides!(mockFormData);

  expect(result.stack).toBe(StackControlsValue.Stack);
});

test('should preserve stack value when formData has null value', () => {
  const mockFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    metrics: ['test_metric'],
    groupby: ['test_column'],
    stack: null,
  };

  const result = config.formDataOverrides!(mockFormData);

  expect(result.stack).toBe(null);
});

test('should preserve stack value when formData does not have stack property', () => {
  const mockFormData = {
    datasource: '1__table',
    viz_type: 'echarts_timeseries_bar',
    metrics: ['test_metric'],
    groupby: ['test_column'],
  };

  const result = config.formDataOverrides!(mockFormData);

  expect(result).not.toHaveProperty('stack');
});
