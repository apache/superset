import { buildQueryContext, QueryFormData, ensureIsArray } from '@superset-ui/core';
import { uniq } from 'lodash';

// Helper to ensure columns have a label to prevent "ValueError: Missing label"
const ensureColumnLabel = (column: any) => {
    if (typeof column === 'string') {
        return column;
    }
    if (column && typeof column === 'object') {
        if (column.label) {
            return column;
        }
        if (column.sqlExpression) {
            return column;
        }
        if (column.column_name) {
            return {
                ...column,
                label: column.column_name,
            };
        }
        // Handle Adhoc Column SIMPLE type where column name is nested
        if (column.column && column.column.column_name) {
            return {
                ...column,
                label: column.column.column_name,
            };
        }
        // Fallback for objects without label/sqlExpression/column_name
        // Use a random suffix to prevent "Duplicate column/metric labels" error if multiple unknown columns exist
        return {
            ...column,
            label: `calculated_column_${Math.random().toString(36).substring(7)}`,
        };
    }
    return column;
};

export default function buildQuery(formData: QueryFormData) {
    const {
        key_column,
        key_sub_column,
        secondary_columns = [],
        metric_column,
        max_metric_column,
        severity_column,
        color_column,
        display_value_column,
    } = formData;

    // Force raw records mode
    const formDataCopy = {
        ...formData,
        query_mode: 'raw',
        include_time: false,
    };

    return buildQueryContext(formDataCopy, (baseQueryObject) => {
        // Use uniq to remove duplicate column references (e.g. if same column is in key and secondary)
        // ensureIsArray handles both single strings ('col') and arrays of strings (['col']) safely
        // filter(Boolean) ensures that optional columns that are not selected (null/undefined) are NOT included in the query
        const rawColumns = uniq([
            ...ensureIsArray(key_column),
            ...ensureIsArray(key_sub_column),
            ...ensureIsArray(secondary_columns),
            ...ensureIsArray(metric_column),
            ...ensureIsArray(max_metric_column),
            ...ensureIsArray(severity_column),
            ...ensureIsArray(color_column),
            ...ensureIsArray(display_value_column),
        ]).filter(Boolean);

        console.log('UnifiedListBarChart plugin buildQuery rawColumns (flattened):', JSON.stringify(rawColumns, null, 2));

        const columns = rawColumns.map(col => {
            const result = ensureColumnLabel(col);
            console.log('UnifiedListBarChart plugin ensureColumnLabel input:', JSON.stringify(col), 'output:', JSON.stringify(result));
            return result;
        });

        return [
            {
                ...baseQueryObject,
                columns,
                metrics: undefined, // Ensure no metrics are sent
                groupby: undefined, // Ensure no groupby is sent
            },
        ];
    });
}
