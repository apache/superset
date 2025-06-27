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
import { SqlaFormData } from '@superset-ui/core';
import * as ChartControls from '@superset-ui/chart-controls';
import controlPanel from './controlPanel';

const { __mockShiftMetric } = ChartControls as any;

jest.mock('@superset-ui/core', () => ({
  GenericDataType: { Numeric: 'numeric' },
  SMART_DATE_ID: 'SMART_DATE_ID',
  t: (str: string) => str,
}));

jest.mock('@superset-ui/chart-controls', () => {
  // Define the mock function inside the factory
  const mockShiftMetric = jest.fn(() => 'shiftedMetric');
  return {
    ControlPanelConfig: {},
    D3_FORMAT_DOCS: 'Format docs',
    D3_TIME_FORMAT_OPTIONS: [['', 'default']],
    getStandardizedControls: () => ({
      shiftMetric: mockShiftMetric,
    }),
    // Optional export to let tests access the mock
    __mockShiftMetric: mockShiftMetric,
  };
});

describe('BigNumber Total Control Panel Config', () => {
  it('should have the required control panel sections', () => {
    expect(controlPanel).toHaveProperty('controlPanelSections');
    const sections = controlPanel.controlPanelSections;
    expect(Array.isArray(sections)).toBe(true);
    expect(sections.length).toBe(2);

    // First section should have label 'Query' and contain rows with metric and adhoc_filters
    expect(sections[0]!.label).toBe('Query');
    expect(Array.isArray(sections[0]!.controlSetRows)).toBe(true);
    expect(sections[0]!.controlSetRows[0]).toEqual(['metric']);
    expect(sections[0]!.controlSetRows[1]).toEqual(['adhoc_filters']);

    // Second section should contain a control named subtitle
    const secondSectionRow = sections[1]!.controlSetRows[1];
    expect(secondSectionRow[0]).toHaveProperty('name', 'subtitle');

    // Second section should include controls for time_format and conditional_formatting
    const thirdSection = sections[1]!.controlSetRows;
    // Check time_format control exists in one of the rows
    const timeFormatRow = thirdSection.find(row =>
      row.some((control: any) => control.name === 'time_format'),
    );
    expect(timeFormatRow).toBeTruthy();
    // Check conditional_formatting control exists in one of the rows
    const conditionalFormattingRow = thirdSection.find(row =>
      row.some((control: any) => control.name === 'conditional_formatting'),
    );
    expect(conditionalFormattingRow).toBeTruthy();
  });

  it('should have y_axis_format override with correct label', () => {
    expect(controlPanel).toHaveProperty('controlOverrides');
    expect(controlPanel.controlOverrides).toHaveProperty('y_axis_format');
    expect(controlPanel.controlOverrides!.y_axis_format!.label).toBe(
      'Number format',
    );
  });

  it('should override formData metric using getStandardizedControls', () => {
    const dummyFormData = { someProp: 'test' } as unknown as SqlaFormData;
    const newFormData = controlPanel.formDataOverrides!(dummyFormData);

    // The original properties are spread correctly.
    expect(newFormData.someProp).toBe('test');
    // The metric property should be replaced by the output of shiftMetric.
    expect(newFormData.metric).toBe('shiftedMetric');

    // Ensure that the mockShiftMetric function was called.
    expect(__mockShiftMetric).toHaveBeenCalled();
  });
});
