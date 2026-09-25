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

// Mock getStandardizedControls so we can assert the Waterfall control panel
// actually consumes (shifts) the queued metric and column instead of
// leaving them for the next viz-type switch to pick up again. Regression
// test for https://github.com/apache/superset/issues/32835, where switching
// away from and back to another chart type (e.g. Line) produced duplicate
// metrics because Waterfall never drained the shared standardized-controls
// queue.
const mockShiftMetric = jest.fn(() => 'shiftedMetric');
const mockShiftColumn = jest.fn(() => 'shiftedColumn');

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
import controlPanel from '../../src/Waterfall/controlPanel';

test('formDataOverrides consumes a single metric and a single column from getStandardizedControls', () => {
  expect(controlPanel.formDataOverrides).toBeDefined();

  const dummyFormData = { someProp: 'test' } as unknown as SqlaFormData;
  const newFormData = controlPanel.formDataOverrides!(dummyFormData);

  // original properties are preserved
  expect(newFormData.someProp).toBe('test');

  // only a single metric is taken (Waterfall only supports one metric),
  // leaving any remaining queued metrics for the next viz-type switch
  expect(newFormData.metric).toBe('shiftedMetric');
  expect(mockShiftMetric).toHaveBeenCalled();

  // only a single column is taken for the (single-value) groupby control,
  // leaving any remaining queued columns for the next viz-type switch;
  // popping the whole queue here would let buildQuery group by columns
  // that transformProps (which only reads groupby[0]) never renders.
  expect(newFormData.groupby).toEqual(['shiftedColumn']);
  expect(mockShiftColumn).toHaveBeenCalled();
});
