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
import { ChartProps, TimeseriesDataRecord, ensureIsArray } from '@superset-ui/core';
import { UnifiedListBarChartProps, UnifiedListBarChartCustomizeProps } from '../types';

// Helper to extract clean column name from formData value (which can be string, array, or object)
const getColumnName = (col: any): string => {
    if (!col) return '';
    if (typeof col === 'string') return col;
    if (Array.isArray(col) && col.length > 0) return getColumnName(col[0]);
    if (typeof col === 'object') {
        if (col.label) return col.label;
        if (col.column_name) return col.column_name;
        if (col.column && col.column.column_name) return col.column.column_name;
        if (col.sqlExpression) return col.sqlExpression;
    }
    return String(col);
};

// Helper to convert ColorPickerControl value (RGBA object) to CSS color string
const rgbaToString = (color: any): string => {
    if (typeof color === 'string') return color;
    if (color && typeof color === 'object' && 'r' in color && 'g' in color && 'b' in color) {
        const a = color.a !== undefined ? color.a : 1;
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`;
    }
    return '#000000'; // Default black
};

export default function transformProps(chartProps: ChartProps): UnifiedListBarChartProps {
    const { width, height, formData, queriesData } = chartProps;

    // Helper to get value from formData with fallback for camelCase/snake_case
    const getProp = (snake: string, camel: string, fallback?: any) => {
        return formData[snake] !== undefined ? formData[snake] : (formData[camel] !== undefined ? formData[camel] : fallback);
    };

    const status_column = getProp('status_column', 'statusColumn');
    const key_column = getProp('key_column', 'keyColumn');
    const key_sub_column = getProp('key_sub_column', 'keySubColumn');
    const arrow_text_column = getProp('arrow_text_column', 'arrowTextColumn');
    const arrow_color_column = getProp('arrow_color_column', 'arrowColorColumn');
    const secondary_columns = getProp('secondary_columns', 'secondaryColumns');
    const tertiary_column = getProp('tertiary_column', 'tertiaryColumn');
    const end_column = getProp('end_column', 'endColumn');

    const rows_per_item = getProp('rows_per_item', 'rowsPerItem', '2');
    const key_font_size = getProp('key_font_size', 'keyFontSize', 16);
    const key_color = getProp('key_color', 'keyColor');
    const key_sub_font_size = getProp('key_sub_font_size', 'keySubFontSize', 11);
    const secondary_font_size = getProp('secondary_font_size', 'secondaryFontSize', 12);
    const display_value_font_size = getProp('display_value_font_size', 'displayValueFontSize', 24);

    const data = queriesData[0].data as TimeseriesDataRecord[];

    // DEBUG: Log to verify values
    console.log('=== TRANSFORM PROPS DEBUG ===');
    console.log('key_column:', key_column);
    console.log('status_column:', status_column);
    console.log('arrow_text_column:', arrow_text_column);
    console.log('end_column:', end_column);

    // Extract clean column names
    const statusColumnName = getColumnName(status_column);
    const keyColumnName = getColumnName(key_column);
    const keySubColumnName = getColumnName(key_sub_column);
    const arrowTextColumnName = getColumnName(arrow_text_column);
    const arrowColorColumnName = getColumnName(arrow_color_column);
    const secondaryColumnNames = ensureIsArray(secondary_columns).map(getColumnName).filter(Boolean);
    const tertiaryColumnName = getColumnName(tertiary_column);
    const endColumnName = getColumnName(end_column);


    const customize: UnifiedListBarChartCustomizeProps = {
        keyColumn: keyColumnName,
        keySubColumn: keySubColumnName || undefined,
        statusColumn: statusColumnName || undefined,
        arrowTextColumn: arrowTextColumnName || undefined,
        arrowColorColumn: arrowColorColumnName || undefined,
        secondaryColumns: secondaryColumnNames,
        tertiaryColumn: tertiaryColumnName || undefined,
        endColumn: endColumnName || undefined,

        // Legacy/Defaults
        metricColumn: undefined,
        maxMetricColumn: undefined,
        displayValueColumn: undefined,

        rowsPerItem: rows_per_item,
        alignMetric: 'right', // Default
        showBar: false,
        showMetricValue: false,
        keyFontSize: Number(key_font_size) || 16,
        keyColor: rgbaToString(key_color),
        keySubFontSize: Number(key_sub_font_size) || 11,
        secondaryFontSize: Number(secondary_font_size) || 12,
        displayValueFontSize: Number(display_value_font_size) || 24,
        barColorPositive: '',
        barColorNegative: '',
    };

    return {
        width,
        height,
        data,
        customize,
    };
}
