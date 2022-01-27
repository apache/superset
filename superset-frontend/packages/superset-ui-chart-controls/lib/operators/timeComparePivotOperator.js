/* eslint-disable camelcase */
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
 * specific language governing permissions and limitationsxw
 * under the License.
 */
import { ComparisionType, ensureIsArray, getColumnLabel, } from '@superset-ui/core';
import { getMetricOffsetsMap, isValidTimeCompare, TIME_COMPARISON_SEPARATOR, } from './utils';
export const timeComparePivotOperator = (formData, queryObject) => {
    const comparisonType = formData.comparison_type;
    const metricOffsetMap = getMetricOffsetsMap(formData, queryObject);
    if (isValidTimeCompare(formData, queryObject)) {
        const valuesAgg = Object.fromEntries([...metricOffsetMap.values(), ...metricOffsetMap.keys()].map(metric => [
            metric,
            // use the 'mean' aggregates to avoid drop NaN
            { operator: 'mean' },
        ]));
        const changeAgg = Object.fromEntries([...metricOffsetMap.entries()]
            .map(([offset, metric]) => [comparisonType, metric, offset].join(TIME_COMPARISON_SEPARATOR))
            // use the 'mean' aggregates to avoid drop NaN
            .map(metric => [metric, { operator: 'mean' }]));
        return {
            operation: 'pivot',
            options: {
                index: ['__timestamp'],
                columns: ensureIsArray(queryObject.columns).map(getColumnLabel),
                aggregates: comparisonType === ComparisionType.Values ? valuesAgg : changeAgg,
                drop_missing_columns: false,
            },
        };
    }
    return undefined;
};
//# sourceMappingURL=timeComparePivotOperator.js.map