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
import {
    QueryFormMetric,
    CategoricalColorNamespace,
    CategoricalColorScale,
    DataRecord,
    getMetricLabel,
    getColumnLabel,
    getValueFormatter,
    tooltipHtml,
} from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';
import type { GaugeSeriesOption } from 'echarts/charts';
import type { GaugeDataItemOption } from 'echarts/types/src/chart/gauge/GaugeSeries';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import { range } from 'lodash';
import { parseNumbersList } from '../utils/controls';
import {
    DEFAULT_FORM_DATA as DEFAULT_GAUGE_FORM_DATA,
    EchartsGaugeFormData,
    AxisTickLineStyle,
    GaugeChartTransformedProps,
    EchartsGaugeChartProps,
} from './types';
import {
    defaultGaugeSeriesOption,
    INTERVAL_GAUGE_SERIES_OPTION,
    OFFSETS,
    FONT_SIZE_MULTIPLIERS,
} from './constants';
import { OpacityEnum } from '../constants';
import { getDefaultTooltip } from '../utils/tooltip';
import { Refs } from '../types';
import { getColtypesMapping } from '../utils/series';

const getRgba = (c: { r: number; g: number; b: number; a: number } | string) => {
    if (typeof c === 'string') return c;
    return `rgba(${c.r}, ${c.g}, ${c.b}, ${c.a})`;
};

export const getIntervalBoundsAndColors = (
    intervals: string,
    intervalColorIndices: string,
    colorFn: CategoricalColorScale,
    min: number,
    max: number,
    colorMode: string,
    singleColor: string | { r: number; g: number; b: number; a: number },
): Array<[number, string]> => {
    if (colorMode === 'single') {
        return [[1, getRgba(singleColor)]];
    }

    if (colorMode === 'default' && !intervals) return [];

    let intervalBoundsNonNormalized;
    let intervalColorIndicesArray;
    try {
        intervalBoundsNonNormalized = parseNumbersList(intervals, ',');
        intervalColorIndicesArray = parseNumbersList(intervalColorIndices, ',');
    } catch (error) {
        intervalBoundsNonNormalized = [] as number[];
        intervalColorIndicesArray = [] as number[];
    }

    const intervalBounds = intervalBoundsNonNormalized.map(
        bound => (bound - min) / (max - min),
    );
    const intervalColors = intervalColorIndicesArray.map(
        ind => colorFn.colors[(ind - 1) % colorFn.colors.length],
    );

    return intervalBounds.map((val, idx) => {
        const color = intervalColors[idx];
        return [val, color || colorFn.colors[idx]];
    });
};

const calculateAxisLineWidth = (
    data: DataRecord[],
    fontSize: number,
    overlap: boolean,
    arcThickness: number,
): number => (/*overlap ? fontSize : data.length * fontSize*/ arcThickness);

const calculateMin = (data: GaugeDataItemOption[]) =>
    2 * Math.min(...data.map(d => d.value as number).concat([0]));

const calculateMax = (data: GaugeDataItemOption[]) =>
    2 * Math.max(...data.map(d => d.value as number).concat([0]));

export default function transformProps(
    chartProps: EchartsGaugeChartProps,
): GaugeChartTransformedProps {
    const {
        width,
        height,
        formData,
        queriesData,
        hooks,
        filterState,
        theme,
        emitCrossFilters,
        datasource,
    } = chartProps;

    const gaugeSeriesOptions = defaultGaugeSeriesOption(theme);
    const {
        verboseMap = {},
        currencyFormats = {},
        columnFormats = {},
        currencyCodeColumn,
    } = datasource;
    const {
        groupby,
        metric,
        minVal,
        maxVal,
        colorScheme,
        fontSize,
        numberFormat,
        currencyFormat,
        animation,
        showProgress,
        overlap,
        roundCap,
        showAxisTick,
        showSplitLine,
        splitNumber,
        startAngle,
        endAngle,
        showPointer,
        intervals,
        intervalColorIndices,
        valueFormatter,
        sliceId,
        // V1 Features
        color_mode,
        single_color,
        inner_radius,
        arc_thickness,
        segment_style,
        needle_color,
        needle_width,
        needle_length,
        needle_style,
        show_center_val,
        center_val_size,
        center_val_weight,
        center_val_color,
        val_prefix,
        val_suffix,
        show_tick_labels,
        tick_density,
        animation_duration,
    }: EchartsGaugeFormData = { ...DEFAULT_GAUGE_FORM_DATA, ...formData };
    const refs: Refs = {};
    const data = (queriesData[0]?.data || []) as DataRecord[];
    const detectedCurrency = queriesData[0]?.detected_currency;
    const coltypeMapping = getColtypesMapping(queriesData[0]);
    const numberFormatter = getValueFormatter(
        metric,
        currencyFormats,
        columnFormats,
        numberFormat,
        currencyFormat,
        undefined,
        data,
        currencyCodeColumn,
        detectedCurrency,
    );
    const colorFn = CategoricalColorNamespace.getScale(colorScheme as string);
    const axisLineWidth = arc_thickness || calculateAxisLineWidth(data, fontSize, overlap, 30);
    const groupbyLabels = groupby.map(getColumnLabel);
    const formatValue = (value: number) =>
        (val_prefix || '') + valueFormatter.replace('{value}', numberFormatter(value)) + (val_suffix || '');
    const axisTickLength = FONT_SIZE_MULTIPLIERS.axisTickLength * fontSize;
    const splitLineLength = FONT_SIZE_MULTIPLIERS.splitLineLength * fontSize;
    const titleOffsetFromTitle =
        FONT_SIZE_MULTIPLIERS.titleOffsetFromTitle * fontSize;
    const detailOffsetFromTitle =
        FONT_SIZE_MULTIPLIERS.detailOffsetFromTitle * fontSize;
    const columnsLabelMap = new Map<string, string[]>();
    const metricLabel = getMetricLabel(metric as QueryFormMetric);

    const transformedData: GaugeDataItemOption[] = data.map(
        (data_point, index) => {
            const name = groupbyLabels
                .map((column: string) => `${verboseMap[column] || column}: ${data_point[column]}`)
                .join(', ');
            const colorLabel = groupbyLabels.map((col: string) => data_point[col] as string);
            columnsLabelMap.set(
                name,
                groupbyLabels.map((col: string) => data_point[col] as string),
            );
            let item: GaugeDataItemOption = {
                value: data_point[metricLabel] as number,
                name,
                itemStyle: {
                    color: colorFn(colorLabel, sliceId),
                },
                title: {
                    offsetCenter: [
                        '0%',
                        `${index * titleOffsetFromTitle + OFFSETS.titleFromCenter}%`,
                    ],
                    fontSize,
                    color: theme.colorTextSecondary,
                },
                detail: {
                    offsetCenter: [
                        '0%',
                        `${index * titleOffsetFromTitle +
                        OFFSETS.titleFromCenter +
                        detailOffsetFromTitle
                        }%`,
                    ],
                    fontSize: center_val_size || (FONT_SIZE_MULTIPLIERS.detailFontSize * fontSize),
                    fontWeight: center_val_weight || 'normal',
                    color: center_val_color ? getRgba(center_val_color) : theme.colorText,
                    show: show_center_val !== false,
                },
            };

            if (
                filterState.selectedValues &&
                !filterState.selectedValues.includes(name)
            ) {
                item = {
                    ...item,
                    itemStyle: {
                        color: colorFn(index, sliceId),
                        opacity: OpacityEnum.SemiTransparent,
                    },
                    detail: {
                        show: false,
                    },
                    title: {
                        show: false,
                    },
                };
            }
            return item;
        },
    );

    const { setDataMask = () => { }, onContextMenu } = hooks;

    const isValidNumber = (
        val: number | null | undefined | string,
    ): val is number => {
        if (val == null || val === '') return false;
        const num = typeof val === 'string' ? Number(val) : val;
        return !Number.isNaN(num) && Number.isFinite(num);
    };

    const min = isValidNumber(minVal)
        ? Number(minVal)
        : calculateMin(transformedData);
    const max = isValidNumber(maxVal)
        ? Number(maxVal)
        : calculateMax(transformedData);

    // Tick Density Logic
    let finalSplitNumber = splitNumber;
    if (tick_density === 'low') finalSplitNumber = 5;
    if (tick_density === 'high') finalSplitNumber = 20;

    const axisLabels = range(min, max, (max - min) / finalSplitNumber);
    const axisLabelLength = Math.max(
        ...axisLabels.map(label => numberFormatter(label).length).concat([1]),
    );

    const intervalBoundsAndColors = getIntervalBoundsAndColors(
        intervals,
        intervalColorIndices,
        colorFn,
        min,
        max,
        color_mode,
        single_color,
    );
    const splitLineDistance =
        axisLineWidth + splitLineLength + OFFSETS.ticksFromLine;
    const axisLabelDistance =
        FONT_SIZE_MULTIPLIERS.axisLabelDistance *
        fontSize *
        FONT_SIZE_MULTIPLIERS.axisLabelLength *
        axisLabelLength +
        (showSplitLine ? splitLineLength : 0) +
        (showAxisTick ? axisTickLength : 0) +
        OFFSETS.ticksFromLine -
        axisLineWidth;
    const axisTickDistance =
        axisLineWidth + axisTickLength + OFFSETS.ticksFromLine;

    const progress = {
        show: showProgress && color_mode === 'default', // Only show default progress if not handling colors manually
        overlap,
        roundCap: roundCap || segment_style === 'rounded',
        width: axisLineWidth, // Align width with arc thickness
    };
    const splitLine = {
        show: showSplitLine,
        distance: -splitLineDistance,
        length: splitLineLength,
        lineStyle: {
            width: FONT_SIZE_MULTIPLIERS.splitLineWidth * fontSize,
            color: gaugeSeriesOptions.splitLine?.lineStyle?.color,
        },
    };
    const axisLine = {
        roundCap: roundCap || segment_style === 'rounded',
        lineStyle: {
            width: axisLineWidth,
            color: intervalBoundsAndColors.length ? intervalBoundsAndColors : gaugeSeriesOptions.axisLine?.lineStyle?.color,
        },
    };
    const axisLabel = {
        show: show_tick_labels,
        distance: -axisLabelDistance,
        fontSize,
        formatter: numberFormatter,
        color: gaugeSeriesOptions.axisLabel?.color,
    };
    const axisTick = {
        show: showAxisTick,
        distance: -axisTickDistance,
        length: axisTickLength,
        lineStyle: gaugeSeriesOptions.axisTick?.lineStyle as AxisTickLineStyle,
    };
    const detail = {
        valueAnimation: animation,
        formatter: (value: number) => formatValue(value),
        color: center_val_color ? getRgba(center_val_color) : gaugeSeriesOptions.detail?.color,
    };
    const tooltip = {
        ...getDefaultTooltip(refs),
        formatter: (params: CallbackDataParams) => {
            const { name, value } = params;
            return tooltipHtml([[metricLabel, formatValue(value as number)]], name);
        },
    };

    let pointer;
    // Needle Customization
    const pointerIcon = needle_style === 'triangle' ? 'triangle' : needle_style === 'rounded' ? 'path://M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 15c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5z' : undefined;

    pointer = {
        show: showPointer,
        showAbove: true,
        icon: pointerIcon,
        itemStyle: {
            color: needle_color ? getRgba(needle_color) : INTERVAL_GAUGE_SERIES_OPTION.pointer?.itemStyle?.color,
        },
        width: needle_width,
        length: `${needle_length}%`,
    };

    const series: GaugeSeriesOption[] = [
        {
            type: 'gauge',
            startAngle,
            endAngle,
            min,
            max,
            progress,
            animation,
            animationDuration: animation_duration,
            axisLine: axisLine as GaugeSeriesOption['axisLine'],
            splitLine,
            splitNumber: finalSplitNumber,
            axisLabel,
            axisTick,
            pointer,
            detail,
            tooltip,
            radius: `${inner_radius}%`, // Use percentage for radius usually? ECharts supports string % or number. Inner radius is actually 'radius' in ECharts gauge, 'innerRadius' is for donut. Gauge only has radius. The prompt said "Inner Radius %". Wait, Gauge doesn't have inner radius. The "Arc Thickness" effectively creates an inner radius.
            // ECharts Gauge 'radius' is the OUTER radius. The inner radius is determined by axisLine.lineStyle.width.
            // If user sets "Inner Radius", maybe they mean the size of the whole chart? Or the HOLE?
            // "Inner Radius (%)" usually implies the hole.
            // If I set radius to 100%, and width to 20, the hole is R-20.
            // If I want to control inner radius explicitly...
            // Let's assume inner_radius control maps to the OUTER radius of the chart (scaling it), 
            // OR map it to `radius` (outer limit) and `arc_thickness` is the width.
            // Standard ECharts Gauge: radius = '75%' (default).
            // I'll map `inner_radius` to the ECharts `radius` property.
            center: ['50%', '55%'],
            data: transformedData,
        },
    ];

    const echartOptions: EChartsCoreOption = {
        tooltip: {
            ...getDefaultTooltip(refs),
            trigger: 'item',
        },
        series,
    };

    return {
        formData,
        width,
        height,
        echartOptions,
        setDataMask,
        emitCrossFilters,
        labelMap: Object.fromEntries(columnsLabelMap),
        groupby,
        selectedValues: filterState.selectedValues || [],
        onContextMenu,
        refs,
        coltypeMapping,
    };
}
