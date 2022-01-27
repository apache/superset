/*
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
/* eslint-disable camelcase */
import { isDruidFormData, } from './types';
export default function extractExtras(formData) {
    const applied_time_extras = {};
    const filters = [];
    const extras = {};
    const extract = {
        filters,
        extras,
        applied_time_extras,
    };
    const reservedColumnsToQueryField = {
        __time_range: 'time_range',
        __time_col: 'granularity_sqla',
        __time_grain: 'time_grain_sqla',
        __time_origin: 'druid_time_origin',
        __granularity: 'granularity',
    };
    (formData.extra_filters || []).forEach(filter => {
        if (filter.col in reservedColumnsToQueryField) {
            const key = filter.col;
            const queryField = reservedColumnsToQueryField[key];
            extract[queryField] = filter.val;
            applied_time_extras[key] = filter.val;
        }
        else {
            filters.push(filter);
        }
    });
    // map to undeprecated names and remove deprecated fields
    if (isDruidFormData(formData) && !extract.druid_time_origin) {
        extras.druid_time_origin = formData.druid_time_origin;
        delete extract.druid_time_origin;
    }
    else {
        // SQL
        extras.time_grain_sqla =
            extract.time_grain_sqla || formData.time_grain_sqla;
        extract.granularity =
            extract.granularity_sqla ||
                formData.granularity ||
                formData.granularity_sqla;
        delete extract.granularity_sqla;
        delete extract.time_grain_sqla;
    }
    // map time range endpoints:
    if (formData.time_range_endpoints)
        extras.time_range_endpoints = formData.time_range_endpoints;
    return extract;
}
//# sourceMappingURL=extractExtras.js.map