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

/**
 * Clean API exports for orval-generated TanStack Query hooks
 *
 * Usage:
 *   import { useGetCharts, useCreateChart } from '@superset-ui/core/api';
 *   import type { Chart, ChartCreatePayload } from '@superset-ui/core/api';
 */

// Re-export all generated hooks and functions
// Custom wrapper for useGetCharts to flatten the parameter structure
import { useGetApiV1Chart } from '../orval-generated-code/charts/charts';
import type { GetListSchema } from '../orval-generated-code/types';

export * from '../orval-generated-code/charts/charts';

// Re-export all generated types (already consolidated in types/index.ts)
export * from '../orval-generated-code/types';

// Re-export custom mutator for advanced usage
export { customInstance } from './mutator';

// POC-compatible aliases for easier migration
export {
  usePostApiV1Chart as useCreateChart,
  usePutApiV1ChartPk as useUpdateChart,
  useDeleteApiV1ChartPk as useDeleteChart,
} from '../orval-generated-code/charts/charts';

export const useGetCharts = (params: GetListSchema) =>
  // Pass params directly - the mutator will wrap them in q=rison.encode(params)
  useGetApiV1Chart(params as any);

// Type aliases for POC compatibility
export type {
  ChartDataRestApiPost as ChartCreatePayload,
  ChartDataRestApiPut as ChartUpdatePayload,
} from '../orval-generated-code/types';
