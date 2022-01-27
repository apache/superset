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
import { ChartDataResponseResult, ChartProps, DataRecordValue, QueryFormColumn, QueryFormData, SetDataMaskHook } from '@superset-ui/core';
import { EchartsLegendFormData } from '../types';
export declare type EchartsPieFormData = QueryFormData & EchartsLegendFormData & {
    colorScheme?: string;
    currentOwnValue?: string[] | null;
    donut: boolean;
    defaultValue?: string[] | null;
    groupby: QueryFormColumn[];
    innerRadius: number;
    labelLine: boolean;
    labelType: EchartsPieLabelType;
    labelsOutside: boolean;
    metric?: string;
    outerRadius: number;
    showLabels: boolean;
    numberFormat: string;
    dateFormat: string;
    showLabelsThreshold: number;
    emitFilter: boolean;
};
export declare enum EchartsPieLabelType {
    Key = "key",
    Value = "value",
    Percent = "percent",
    KeyValue = "key_value",
    KeyPercent = "key_percent",
    KeyValuePercent = "key_value_percent"
}
export interface EchartsPieChartProps extends ChartProps {
    formData: EchartsPieFormData;
    queriesData: ChartDataResponseResult[];
}
export declare const DEFAULT_FORM_DATA: EchartsPieFormData;
export interface PieChartTransformedProps {
    formData: EchartsPieFormData;
    height: number;
    width: number;
    echartOptions: EChartsCoreOption;
    emitFilter: boolean;
    setDataMask: SetDataMaskHook;
    labelMap: Record<string, DataRecordValue[]>;
    groupby: QueryFormColumn[];
    selectedValues: Record<number, string>;
}
//# sourceMappingURL=types.d.ts.map