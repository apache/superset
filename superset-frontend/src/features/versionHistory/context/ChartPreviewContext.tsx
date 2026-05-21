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
 * Exposes the form_data computed from a historical version snapshot so the
 * chart panel can shadow-render the preview without touching Redux.
 * ``null`` means no preview is active and consumers should use their normal
 * (live) form_data.
 */
export const ChartPreviewContext = createContext<QueryFormData | null>(null);

export function useChartPreviewFormData(): QueryFormData | null {
  return useContext(ChartPreviewContext);
}
