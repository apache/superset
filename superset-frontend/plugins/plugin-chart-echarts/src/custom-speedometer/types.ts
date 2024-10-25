import { DataRecord, QueryFormData } from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

// Data that will be used by the Chart
export type SpeedometerChartFormData = QueryFormData & {
    metrix: string;
    minValue: number | null;
    maxValue: number | null;
    threshholdRanges?: [ number, number, number, number];
    colorSheme?: string;
    label?: string;
    numberFormat?: string;
    showLabel?: boolean;
    segmentAmt: number;
    s1ChartColor: string;
    s1Start: number;
    s1End: number;
    testVal: number
}

// Define the strucute for the query data returned by Superset
export interface SpeedometerQueryData {
    data: DataRecord[];
    key: string;
    value: number;
}

// Define the props that the speedometer component will recieve
export interface SpeedometerChartProps {
    width: number;
    height: number;
    data: SpeedometerQueryData[];
    minValue?: number;
    maxValue?: number;
    threshholdRanges?: [ number, number, number, number];
    colorSheme?: string;
    label?: string;
    numberFormat?: string;
    showLabel?: boolean;
    segmentAmt?: number;
    s1ChartColor?: string;
    s1Start?: number;
    s1End?: number;
}

// Defines defailt values for the SpeedometerChartFormData (fallback values)
export const DEFAULT_FORM_DATA: Partial<SpeedometerChartFormData> = {
    ...DEFAULT_LEGEND_FORM_DATA,
    minValue: 0,
    maxValue: 100,
    segmentAmt: 6,
    s1ChartColor: '#02F702',
    s1Start: 0,
    s1End: 50,
}

// Transform props for the Speedometer
export interface SpeedometerTransformProps {
    width: number;
    height: number;
    formData: SpeedometerChartFormData;
    queriesData: SpeedometerQueryData[];
}