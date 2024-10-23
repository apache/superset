import { DataRecord, QueryFormData } from '@superset-ui/core';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  CrossFilterTransformedProps,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

// Define structure of fthe form data used by Speedometer Chart
export type SpeedometerChartFormData = QueryFormData & {
    metrix: string;
    minValue: number;
    maxValue: number;
    threshholdRanges?: [ number, number, number, number];
    colorSheme?: string;
    label?: string;
    numberFormat?: string;
    showLabel?: boolean;
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
}

export const DEFAULT_FORM_DATA: Partial<SpeedometerChartFormData> = {
    ...DEFAULT_LEGEND_FORM_DATA,
    minValue: 0,
    maxValue: 100,
}

// Transform props for the Speedometer
export interface SpeedometerTransformProps {
    width: number;
    height: number;
    formData: SpeedometerChartFormData;
    queriesData: SpeedometerQueryData[];
}