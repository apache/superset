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
import { buildQueryContext, QueryFormData, ensureIsArray } from '@superset-ui/core';

/**
 * Ensures every column object has a `label` property to prevent
 * "ValueError: Missing label" from the Superset backend.
 */
const ensureColumnLabel = (column: any) => {
    if (typeof column === 'string') return column;
    if (column && typeof column === 'object') {
        if (column.label) return column;
        if (column.sqlExpression) return column;
        if (column.column_name) return { ...column, label: column.column_name };
        if (column.column?.column_name) {
            return { ...column, label: column.column.column_name };
        }
        return {
            ...column,
            label: `calculated_column_${Math.random().toString(36).substring(7)}`,
        };
    }
    return column;
};

export default function buildQuery(formData: QueryFormData) {
    const {
        title_column,
        subtitle_column,
        kpi_columns = [],
        ticker_message_column,
    } = formData;

    const formDataCopy = {
        ...formData,
        query_mode: 'raw',
        include_time: false,
    };

    return buildQueryContext(formDataCopy, (baseQueryObject) => {
        const rawColumns = [
            ...ensureIsArray(title_column),
            ...ensureIsArray(subtitle_column),
            ...ensureIsArray(kpi_columns),
            ...ensureIsArray(ticker_message_column),
        ].filter(Boolean);

        // Deduplicate by label/column_name
        const seen = new Set<string>();
        const uniqueColumns = rawColumns.filter((col) => {
            const key =
                typeof col === 'string'
                    ? col
                    : col?.label || col?.column_name || JSON.stringify(col);
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });

        const columns = uniqueColumns.map(ensureColumnLabel);

        return [
            {
                ...baseQueryObject,
                columns,
                metrics: undefined,
                groupby: undefined,
            },
        ];
    });
}
