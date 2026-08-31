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

const mockShiftMetric = jest
  .fn()
  .mockReturnValueOnce('left_sum')
  .mockReturnValueOnce('right_sum');
const mockShiftColumn = jest.fn(() => 'category');

jest.mock('@superset-ui/chart-controls', () => {
  const actual = jest.requireActual('@superset-ui/chart-controls');
  return {
    ...actual,
    getStandardizedControls: jest.fn(() => ({
      shiftMetric: mockShiftMetric,
      shiftColumn: mockShiftColumn,
    })),
  };
});

// eslint-disable-next-line import/first
import controlPanel from '../../src/Butterfly/controlPanel';

const collectControlNames = () => {
  const names = new Set<string>();
  controlPanel.controlPanelSections?.forEach(section => {
    section?.controlSetRows?.forEach(row => {
      row.forEach(control => {
        if (typeof control === 'string') {
          names.add(control);
        } else if (
          control &&
          typeof control === 'object' &&
          'name' in control
        ) {
          names.add(String(control.name));
        }
      });
    });
  });
  return names;
};

test('exposes left and right metric controls', () => {
  const controlNames = collectControlNames();
  expect(controlNames.has('left_metric')).toBe(true);
  expect(controlNames.has('right_metric')).toBe(true);
  expect(controlNames.has('groupby')).toBe(true);
  expect(controlNames.has('orderby')).toBe(true);
});

test('restricts categories to a single dimension', () => {
  expect(controlPanel.controlOverrides?.groupby?.multi).toBe(false);
});

test('maps standardized controls to butterfly metrics', () => {
  const dummyFormData = { someProp: 'test' } as unknown as SqlaFormData;
  const formData = controlPanel.formDataOverrides?.(dummyFormData);

  expect(formData?.someProp).toBe('test');
  expect(formData?.groupby).toEqual(['category']);
  expect(formData?.left_metric).toBe('left_sum');
  expect(formData?.right_metric).toBe('right_sum');
  expect(mockShiftMetric).toHaveBeenCalledTimes(2);
  expect(mockShiftColumn).toHaveBeenCalledTimes(1);
});
