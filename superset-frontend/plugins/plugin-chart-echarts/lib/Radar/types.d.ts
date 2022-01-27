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
import { EChartsCoreOption } from 'echarts';
import { ChartDataResponseResult, ChartProps, DataRecordValue, QueryFormColumn, QueryFormData, QueryFormMetric, SetDataMaskHook } from '@superset-ui/core';
import { EchartsLegendFormData, LabelPositionEnum } from '../types';
declare type RadarColumnConfig = Record<string, {
    radarMetricMaxValue?: number;
}>;
export declare type EchartsRadarFormData = QueryFormData & EchartsLegendFormData & {
    colorScheme?: string;
    columnConfig?: RadarColumnConfig;
    currentOwnValue?: string[] | null;
    currentValue?: string[] | null;
    defaultValue?: string[] | null;
    groupby: QueryFormColumn[];
    labelType: EchartsRadarLabelType;
    labelPosition: LabelPositionEnum;
    metrics: QueryFormMetric[];
    showLabels: boolean;
    isCircle: boolean;
    numberFormat: string;
    dateFormat: string;
    emitFilter: boolean;
};
export declare enum EchartsRadarLabelType {
    Value = "value",
    KeyValue = "key_value"
}
export interface EchartsRadarChartProps extends ChartProps {
    formData: EchartsRadarFormData;
    queriesData: ChartDataResponseResult[];
}
export declare const DEFAULT_FORM_DATA: EchartsRadarFormData;
export interface RadarChartTransformedProps {
    formData: EchartsRadarFormData;
    height: number;
    width: number;
    echartOptions: EChartsCoreOption;
    setDataMask: SetDataMaskHook;
    labelMap: Record<string, DataRecordValue[]>;
    groupby: QueryFormColumn[];
    selectedValues: Record<number, string>;
}
export {};
//# sourceMappingURL=types.d.ts.map