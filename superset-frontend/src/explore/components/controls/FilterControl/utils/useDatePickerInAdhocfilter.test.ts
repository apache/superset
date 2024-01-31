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
import { renderHook } from '@testing-library/react-hooks';
import { TestDataset } from '@superset-ui/chart-controls';
import { useDatePickerInAdhocFilter } from './useDatePickerInAdhocFilter';

test('should return undefined if column is not temporal', () => {
  const { result } = renderHook(() =>
    useDatePickerInAdhocFilter({
      columnName: 'gender',
      datasource: TestDataset,
      onChange: jest.fn(),
    }),
  );
  expect(result.current).toBeUndefined();
});

test('should return JSX', () => {
  const { result } = renderHook(() =>
    useDatePickerInAdhocFilter({
      columnName: 'ds',
      datasource: TestDataset,
      onChange: jest.fn(),
    }),
  );
  expect(result.current).not.toBeUndefined();
});
