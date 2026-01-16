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

import { GenericDataType } from '@apache-superset/core/api/core';
import { xAxisForceCategoricalControl } from '../../src/shared-controls/customControls';
import { checkColumnType } from '../../src/utils/checkColumnType';
import type { ControlState } from '@superset-ui/chart-controls';

jest.mock('../../src/utils/checkColumnType');
jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  getColumnLabel: jest.fn((col: any) => col),
}));

test('xAxisForceCategoricalControl should not treat temporal columns as categorical when x_axis_sort exists', () => {
  const mockCheckColumnType = jest.mocked(checkColumnType);

  mockCheckColumnType.mockReturnValue(false); // temporal column (not numeric)

  const control: ControlState = { value: false, type: 'CheckboxControl' };
  const state = {
    form_data: { x_axis_sort: 'asc' },
    controls: {
      x_axis: { value: 'date_column' },
      datasource: { datasource: {} },
    },
  };

  const result = xAxisForceCategoricalControl.config.initialValue!(
    control,
    state as any,
  );

  // Verify: should return control value (false) for non-numeric columns
  expect(result).toBe(false);
  expect(mockCheckColumnType).toHaveBeenCalledWith('date_column', {}, [
    GenericDataType.Numeric,
  ]);

  mockCheckColumnType.mockClear();
});
