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
import { QueryFormColumn, QueryFormData } from '@superset-ui/core';
import {
    BaseChartProps,
    BaseTransformedProps,
    ContextMenuTransformedProps,
    CrossFilterTransformedProps,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

export type AxisTickLineStyle = {
    width: number;
    color: string;
};

export type EchartsGaugeFormData = QueryFormData & {
    colorScheme?: string;
    groupby: QueryFormColumn[];
    metric?: string;
    rowLimit: number;
    minVal: number | null;
    maxVal: number | null;
    fontSize: number;
    numberFormat: string;
    animation: boolean;
    showProgress: boolean;
    overlap: boolean;
    roundCap: boolean;
    showAxisTick: boolean;
    showSplitLine: boolean;
    splitNumber: number;
    startAngle: number;
    endAngle: number;
    showPointer: boolean;
    intervals: string;
    intervalColorIndices: string;
    valueFormatter: string;
    // V1 Features
    color_mode: 'default' | 'single' | 'multi';
    single_color: { r: number; g: number; b: number; a: number } | string;
    inner_radius: number;
    arc_thickness: number;
    segment_style: 'smooth' | 'segmented' | 'rounded';
    needle_color: { r: number; g: number; b: number; a: number } | string;
    needle_width: number;
    needle_length: number;
    needle_style: 'default' | 'rounded' | 'triangle';
    show_center_val: boolean;
    center_val_size: number;
    center_val_weight: 'normal' | 'bold';
    center_val_color: { r: number; g: number; b: number; a: number } | string;
    val_prefix: string;
    val_suffix: string;
    show_tick_labels: boolean;
    tick_density: 'low' | 'medium' | 'high';
    animation_duration: number;
};

export const DEFAULT_FORM_DATA: Partial<EchartsGaugeFormData> = {
    ...DEFAULT_LEGEND_FORM_DATA,
    groupby: [],
    rowLimit: 10,
    minVal: null,
    maxVal: null,
    fontSize: 15,
    numberFormat: 'SMART_NUMBER',
    animation: true,
    showProgress: true,
    overlap: true,
    roundCap: false,
    showAxisTick: false,
    showSplitLine: false,
    splitNumber: 10,
    startAngle: 225,
    endAngle: -45,
    showPointer: true,
    intervals: '',
    intervalColorIndices: '',
    valueFormatter: '{value}',
    // V1 Defaults
    color_mode: 'default',
    inner_radius: 75,
    arc_thickness: 30,
    segment_style: 'smooth',
    needle_width: 5,
    needle_length: 60,
    needle_style: 'default',
    show_center_val: true,
    center_val_weight: 'normal',
    val_prefix: '',
    val_suffix: '',
    show_tick_labels: true,
    tick_density: 'medium',
    animation_duration: 1000,
};

export interface EchartsGaugeChartProps extends BaseChartProps<EchartsGaugeFormData> {
    formData: EchartsGaugeFormData;
    // Props inherited from ChartProps but explicitly needed here if BaseChartProps is not sufficient
    width: number;
    height: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    hooks: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    filterState: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    theme: any;
    emitCrossFilters?: boolean;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    datasource: any;
}

export type GaugeChartTransformedProps =
    BaseTransformedProps<EchartsGaugeFormData> &
    ContextMenuTransformedProps &
    CrossFilterTransformedProps;
