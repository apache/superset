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
import { QueryMode } from '@superset-ui/core';
import { BuildQuery } from '@superset-ui/core/src/chart/registries/ChartBuildQueryRegistrySingleton';
import { TableChartFormData } from './types';
/**
 * Infer query mode from form data. If `all_columns` is set, then raw records mode,
 * otherwise defaults to aggregation mode.
 *
 * The same logic is used in `controlPanel` with control values as well.
 */
export declare function getQueryMode(formData: TableChartFormData): QueryMode;
export declare const cachedBuildQuery: () => BuildQuery<TableChartFormData>;
declare const _default: BuildQuery<TableChartFormData>;
export default _default;
//# sourceMappingURL=buildQuery.d.ts.map