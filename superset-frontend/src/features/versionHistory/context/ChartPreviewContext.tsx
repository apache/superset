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
import { createContext, useContext } from 'react';
import { QueryFormData } from '@superset-ui/core';

/**
 * Slice-level scalars that the Explore header / metadata bar read directly
 * from Redux. During preview these need to reflect the historical snapshot
 * without mutating the live ``explore.slice`` Redux subtree (which would
 * trigger "unsaved changes" tracking, sliceUpdated subscribers, etc.).
 */
export interface ChartPreviewSliceOverrides {
  slice_name?: string;
  description?: string | null;
  certified_by?: string;
  certification_details?: string;
}

export interface ChartPreviewValue {
  formData: QueryFormData | null;
  slice: ChartPreviewSliceOverrides | null;
}

const EMPTY: ChartPreviewValue = { formData: null, slice: null };

/**
 * Exposes the form_data + slice-level scalar overrides computed from a
 * historical version snapshot so the chart panel can shadow-render the
 * preview without touching Redux. ``formData`` of ``null`` means no preview
 * is active and consumers should use their normal (live) values.
 */
export const ChartPreviewContext = createContext<ChartPreviewValue>(EMPTY);

export function useChartPreviewFormData(): QueryFormData | null {
  return useContext(ChartPreviewContext).formData;
}

export function useChartPreviewSlice(): ChartPreviewSliceOverrides | null {
  return useContext(ChartPreviewContext).slice;
}
