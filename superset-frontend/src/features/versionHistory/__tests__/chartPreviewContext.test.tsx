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
import { renderHook } from '@testing-library/react';
import {
  ChartPreviewContext,
  ChartPreviewValue,
  useChartPreviewFormData,
  useChartPreviewSlice,
} from '../context/ChartPreviewContext';

function wrapWith(value: ChartPreviewValue) {
  return ({ children }: { children: React.ReactNode }) => (
    <ChartPreviewContext.Provider value={value}>
      {children}
    </ChartPreviewContext.Provider>
  );
}

test('useChartPreviewFormData and useChartPreviewSlice return null without a provider', () => {
  const { result: form } = renderHook(() => useChartPreviewFormData());
  const { result: slice } = renderHook(() => useChartPreviewSlice());
  expect(form.current).toBeNull();
  expect(slice.current).toBeNull();
});

test('useChartPreviewSlice exposes snapshot slice-level scalars through context', () => {
  const value: ChartPreviewValue = {
    formData: null,
    slice: {
      slice_name: 'Snapshot name',
      description: 'Snapshot description',
      certified_by: 'A. Admin',
      certification_details: 'verified',
    },
  };
  const { result } = renderHook(() => useChartPreviewSlice(), {
    wrapper: wrapWith(value),
  });
  expect(result.current).toEqual(value.slice);
});

test('useChartPreviewFormData independently exposes formData when slice is null', () => {
  const value: ChartPreviewValue = {
    formData: { viz_type: 'big_number_total' } as unknown as NonNullable<
      ChartPreviewValue['formData']
    >,
    slice: null,
  };
  const { result } = renderHook(() => useChartPreviewFormData(), {
    wrapper: wrapWith(value),
  });
  expect(result.current?.viz_type).toBe('big_number_total');
});
