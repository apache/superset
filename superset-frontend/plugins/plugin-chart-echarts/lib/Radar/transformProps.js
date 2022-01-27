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
import { CategoricalColorNamespace, ensureIsInt, getColumnLabel, getMetricLabel, getNumberFormatter, getTimeFormatter, } from '@superset-ui/core';
import { DEFAULT_FORM_DATA as DEFAULT_RADAR_FORM_DATA, EchartsRadarLabelType, } from './types';
import { DEFAULT_LEGEND_FORM_DATA } from '../types';
import { extractGroupbyLabel, getChartPadding, getColtypesMapping, getLegendProps, } from '../utils/series';
import { defaultGrid, defaultTooltip } from '../defaults';
import { OpacityEnum } from '../constants';
export function formatLabel({ params, labelType, numberFormatter, }) {
    const { name = '', value } = params;
    const formattedValue = numberFormatter(value);
    switch (labelType) {
        case EchartsRadarLabelType.Value:
            return formattedValue;
        case EchartsRadarLabelType.KeyValue:
            return `${name}: ${formattedValue}`;
        default:
            return name;
    }
}
export default function transformProps(chartProps) {
    const { formData, height, hooks, filterState, queriesData, width } = chartProps;
    const { data = [] } = queriesData[0];
    const coltypeMapping = getColtypesMapping(queriesData[0]);
    const { colorScheme, groupby, labelType, labelPosition, legendOrientation, legendType, legendMargin, metrics = [], numberFormat, dateFormat, showLabels, showLegend, isCircle, columnConfig, } = {
        ...DEFAULT_LEGEND_FORM_DATA,
        ...DEFAULT_RADAR_FORM_DATA,
        ...formData,
    };
    const { setDataMask = () => { } } = hooks;
    const colorFn = CategoricalColorNamespace.getScale(colorScheme);
    const numberFormatter = getNumberFormatter(numberFormat);
    const formatter = (params) => formatLabel({
        params,
        numberFormatter,
        labelType,
    });
    const metricLabels = metrics.map(getMetricLabel);
    const groupbyLabels = groupby.map(getColumnLabel);
    const metricLabelAndMaxValueMap = new Map();
    const columnsLabelMap = new Map();
    const transformedData = [];
    data.forEach(datum => {
        const joinedName = extractGroupbyLabel({
            datum,
            groupby: groupbyLabels,
            coltypeMapping,
            timeFormatter: getTimeFormatter(dateFormat),
        });
        // map(joined_name: [columnLabel_1, columnLabel_2, ...])
        columnsLabelMap.set(joinedName, groupbyLabels.map(col => datum[col]));
        // put max value of series into metricLabelAndMaxValueMap
        // eslint-disable-next-line no-restricted-syntax
        for (const [metricLabel, value] of Object.entries(datum)) {
            if (metricLabelAndMaxValueMap.has(metricLabel)) {
                metricLabelAndMaxValueMap.set(metricLabel, Math.max(value, ensureIsInt(metricLabelAndMaxValueMap.get(metricLabel), Number.MIN_SAFE_INTEGER)));
            }
            else {
                metricLabelAndMaxValueMap.set(metricLabel, value);
            }
        }
        const isFiltered = filterState.selectedValues &&
            !filterState.selectedValues.includes(joinedName);
        // generate transformedData
        transformedData.push({
            value: metricLabels.map(metricLabel => datum[metricLabel]),
            name: joinedName,
            itemStyle: {
                color: colorFn(joinedName),
                opacity: isFiltered
                    ? OpacityEnum.Transparent
                    : OpacityEnum.NonTransparent,
            },
            lineStyle: {
                opacity: isFiltered
                    ? OpacityEnum.SemiTransparent
                    : OpacityEnum.NonTransparent,
            },
            label: {
                show: showLabels,
                position: labelPosition,
                formatter,
            },
        });
    });
    const selectedValues = (filterState.selectedValues || []).reduce((acc, selectedValue) => {
        const index = transformedData.findIndex(({ name }) => name === selectedValue);
        return {
            ...acc,
            [index]: selectedValue,
        };
    }, {});
    const indicator = metricLabels.map(metricLabel => {
        const maxValueInControl = columnConfig?.[metricLabel]?.radarMetricMaxValue;
        // Ensure that 0 is at the center of the polar coordinates
        const metricValueAsMax = metricLabelAndMaxValueMap.get(metricLabel) === 0
            ? Number.MAX_SAFE_INTEGER
            : metricLabelAndMaxValueMap.get(metricLabel);
        const max = maxValueInControl === null ? metricValueAsMax : maxValueInControl;
        return {
            name: metricLabel,
            max,
        };
    });
    const series = [
        {
            type: 'radar',
            ...getChartPadding(showLegend, legendOrientation, legendMargin),
            animation: false,
            emphasis: {
                label: {
                    show: true,
                    fontWeight: 'bold',
                    backgroundColor: 'white',
                },
            },
            data: transformedData,
        },
    ];
    const echartOptions = {
        grid: {
            ...defaultGrid,
        },
        tooltip: {
            ...defaultTooltip,
            trigger: 'item',
        },
        legend: {
            ...getLegendProps(legendType, legendOrientation, showLegend),
            data: Array.from(columnsLabelMap.keys()),
        },
        series,
        radar: {
            shape: isCircle ? 'circle' : 'polygon',
            indicator,
        },
    };
    return {
        formData,
        width,
        height,
        echartOptions,
        setDataMask,
        labelMap: Object.fromEntries(columnsLabelMap),
        groupby,
        selectedValues,
    };
}
//# sourceMappingURL=transformProps.js.map