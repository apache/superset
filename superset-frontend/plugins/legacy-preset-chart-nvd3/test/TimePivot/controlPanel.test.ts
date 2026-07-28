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
import controlPanel from '../../src/TimePivot/controlPanel';

const { __mockShiftMetric } = ChartControls as typeof ChartControls & {
  __mockShiftMetric: jest.Mock;
};

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  t: (str: string) => str,
}));

jest.mock('@superset-ui/chart-controls', () => {
  const original = jest.requireActual('@superset-ui/chart-controls');
  const mockShiftMetric = jest.fn(() => 'shiftedMetric');
  return {
    ...original,
    getStandardizedControls: () => ({
      shiftMetric: mockShiftMetric,
    }),
    __mockShiftMetric: mockShiftMetric,
  };
});

describe('TimePivot Control Panel Config', () => {
  test('should override formData metric using getStandardizedControls', () => {
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
