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

    // Extract values using camelCase (Superset converts snake_case control names to camelCase)
    const {
        keyColumn,
        keySubColumn,
        secondaryColumns,
        metricColumn,
        maxMetricColumn,
        severityColumn,
        colorColumn,
        rowsPerItem = '2',
        alignMetric = 'right',
        showBar = true,
        showMetricValue = true,
        keyFontSize = 16,
        keyColor,
        keySubFontSize = 11,
        secondaryFontSize = 12,
        barColorPositive,
        barColorNegative,
        conditionalColorRules,
        iconRules,
    } = formData;

    const data = queriesData[0].data as TimeseriesDataRecord[];

    // DEBUG: Log to verify values
    console.log('=== TRANSFORM PROPS DEBUG ===');
    console.log('keyColumn:', keyColumn);
    console.log('keySubColumn:', keySubColumn);
    console.log('colorColumn:', colorColumn);
    console.log('metricColumn:', metricColumn);
    console.log('keyFontSize:', keyFontSize, 'secondaryFontSize:', secondaryFontSize);

    // Extract clean column names
    const keyColumnName = getColumnName(keyColumn);
    const keySubColumnName = getColumnName(keySubColumn);
    const secondaryColumnNames = ensureIsArray(secondaryColumns).map(getColumnName).filter(Boolean);
    const metricColumnName = getColumnName(metricColumn);
    const maxMetricColumnName = getColumnName(maxMetricColumn);
    const severityColumnName = getColumnName(severityColumn);
    const colorColumnName = getColumnName(colorColumn);

    const customize: UnifiedListBarChartCustomizeProps = {
        keyColumn: keyColumnName,
        keySubColumn: keySubColumnName || undefined,
        secondaryColumns: secondaryColumnNames,
        metricColumn: metricColumnName || undefined,
        maxMetricColumn: maxMetricColumnName || undefined,
        severityColumn: severityColumnName || undefined,
        colorColumn: colorColumnName || undefined,
        rowsPerItem: rowsPerItem,
        alignMetric: alignMetric,
        showBar: showBar,
        showMetricValue: showMetricValue,
        keyFontSize: Number(keyFontSize) || 16,
        keyColor: rgbaToString(keyColor),
        keySubFontSize: Number(keySubFontSize) || 11,
        secondaryFontSize: Number(secondaryFontSize) || 12,
        barColorPositive: rgbaToString(barColorPositive),
        barColorNegative: rgbaToString(barColorNegative),
        conditionalColorRules: typeof conditionalColorRules === 'string'
            ? JSON.parse(conditionalColorRules)
            : conditionalColorRules,
        iconRules: typeof iconRules === 'string'
            ? JSON.parse(iconRules)
            : iconRules,
    };

    return {
        width,
        height,
        data,
        customize,
    };
}
