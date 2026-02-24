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
import {
    DashboardUtilityBarProps,
    DashboardUtilityBarCustomizeProps,
    LayoutMode,
    OverlayPosition,
    OverlayAnimation,
    TickerDirection,
} from '../types';

/**
 * Extract a clean column name string from a formData value
 * (which can be string, array, or adhoc column object).
 */
const getColumnName = (col: any): string => {
    if (!col) return '';
    if (typeof col === 'string') return col;
    if (Array.isArray(col) && col.length > 0) return getColumnName(col[0]);
    if (typeof col === 'object') {
        if (col.label) return col.label;
        if (col.column_name) return col.column_name;
        if (col.column?.column_name) return col.column.column_name;
        if (col.sqlExpression) return col.sqlExpression;
    }
    return String(col);
};

/**
 * Convert a ColorPickerControl RGBA object to a CSS color string.
 */
const rgbaToString = (color: any, fallback = 'rgba(30, 30, 30, 0.95)'): string => {
    if (typeof color === 'string') return color;
    if (
        color &&
        typeof color === 'object' &&
        'r' in color &&
        'g' in color &&
        'b' in color
    ) {
        const a = color.a !== undefined ? color.a : 1;
        return `rgba(${color.r}, ${color.g}, ${color.b}, ${a})`;
    }
    return fallback;
};

export default function transformProps(
    chartProps: ChartProps,
): DashboardUtilityBarProps {
    const { width, height, formData, queriesData } = chartProps;

    const {
        titleColumn,
        subtitleColumn,
        kpiColumns,
        tickerMessageColumn,
        layoutMode = 'header',
        overlayPosition = 'top',
        overlayZIndex = 1000,
        overlayAnimation = 'slide',
        showTitle = true,
        showSubtitle = false,
        showClock = false,
        showDate = false,
        showWeather = false,
        showKpi = true,
        showTicker = false,
        showCustomRightSlot = false,
        tickerSpeed = 20,
        tickerDirection = 'left',
        tickerSeparator = '  •  ',
        autoHideNoData = false,
        autoHideSeconds = 0,
        backgroundColor,
        textColor,
    } = formData;

    // Safely extract data — handle undefined / empty queriesData
    const data = (queriesData?.[0]?.data as TimeseriesDataRecord[]) ?? [];

    const titleColumnName = getColumnName(titleColumn);
    const subtitleColumnName = getColumnName(subtitleColumn);
    const kpiColumnNames = ensureIsArray(kpiColumns)
        .map(getColumnName)
        .filter(Boolean);
    const tickerMessageColumnName = getColumnName(tickerMessageColumn);

    const customize: DashboardUtilityBarCustomizeProps = {
        layoutMode: layoutMode as LayoutMode,
        overlayPosition: overlayPosition as OverlayPosition,
        overlayZIndex: Number(overlayZIndex) || 1000,
        overlayAnimation: overlayAnimation as OverlayAnimation,

        titleColumn: titleColumnName || undefined,
        subtitleColumn: subtitleColumnName || undefined,
        kpiColumns: kpiColumnNames,
        tickerMessageColumn: tickerMessageColumnName || undefined,

        showTitle,
        showSubtitle,
        showClock,
        showDate,
        showWeather,
        showKpi,
        showTicker,
        showCustomRightSlot,

        tickerSpeed: Number(tickerSpeed) || 20,
        tickerDirection: tickerDirection as TickerDirection,
        tickerSeparator: tickerSeparator ?? '  •  ',

        autoHideNoData,
        autoHideSeconds: Number(autoHideSeconds) || 0,

        backgroundColor: rgbaToString(backgroundColor, 'rgba(30, 30, 30, 0.95)'),
        textColor: rgbaToString(textColor, 'rgba(255, 255, 255, 1)'),
    };

    return { width, height, data, customize };
}
