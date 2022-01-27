import { ExtraFormDataAppend, ExtraFormDataOverrideExtras, ExtraFormDataOverrideRegular, ExtraFormDataOverride, QueryObject } from './types';
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
export declare const DTTM_ALIAS = "__timestamp";
export declare const EXTRA_FORM_DATA_OVERRIDE_EXTRA_KEYS: (keyof ExtraFormDataOverrideExtras)[];
export declare const EXTRA_FORM_DATA_APPEND_KEYS: (keyof ExtraFormDataAppend)[];
export declare const EXTRA_FORM_DATA_OVERRIDE_REGULAR_MAPPINGS: Record<keyof ExtraFormDataOverrideRegular, keyof QueryObject>;
export declare const EXTRA_FORM_DATA_OVERRIDE_REGULAR_KEYS: ("granularity" | "time_column" | "time_grain" | "time_range" | "granularity_sqla")[];
export declare const EXTRA_FORM_DATA_OVERRIDE_KEYS: (keyof ExtraFormDataOverride)[];
//# sourceMappingURL=constants.d.ts.map