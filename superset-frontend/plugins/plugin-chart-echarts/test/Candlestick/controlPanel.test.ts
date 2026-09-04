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

const mockShiftMetric = jest.fn();

jest.mock('@superset-ui/chart-controls', () => {
  const actual = jest.requireActual('@superset-ui/chart-controls');
  return {
    ...actual,
    getStandardizedControls: jest.fn(() => ({
      shiftMetric: mockShiftMetric,
    })),
  };
});

// eslint-disable-next-line import/first
import controlPanel from '../../src/Candlestick/controlPanel';

test('formDataOverrides consumes four metrics for open, close, high, and low', () => {
  mockShiftMetric
    .mockReturnValueOnce('openMetric')
    .mockReturnValueOnce('closeMetric')
    .mockReturnValueOnce('highMetric')
    .mockReturnValueOnce('lowMetric');

  expect(controlPanel.formDataOverrides).toBeDefined();

  const dummyFormData = { someProp: 'test' } as unknown as SqlaFormData;
  const newFormData = controlPanel.formDataOverrides!(dummyFormData);

  expect(newFormData.someProp).toBe('test');
  expect(newFormData.open).toBe('openMetric');
  expect(newFormData.close).toBe('closeMetric');
  expect(newFormData.high).toBe('highMetric');
  expect(newFormData.low).toBe('lowMetric');
  expect(mockShiftMetric).toHaveBeenCalledTimes(4);
});
