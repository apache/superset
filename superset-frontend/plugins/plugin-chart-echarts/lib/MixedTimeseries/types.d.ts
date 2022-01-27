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
import { AnnotationLayer, TimeGranularity, DataRecordValue, SetDataMaskHook, QueryFormData, ChartProps, ChartDataResponseResult, QueryFormColumn } from '@superset-ui/core';
import { EchartsLegendFormData, EchartsTitleFormData } from '../types';
import { EchartsTimeseriesContributionType, EchartsTimeseriesSeriesType } from '../Timeseries/types';
export declare type EchartsMixedTimeseriesFormData = QueryFormData & {
    annotationLayers: AnnotationLayer[];
    minorSplitLine: boolean;
    logAxis: boolean;
    logAxisSecondary: boolean;
    yAxisFormat?: string;
    yAxisFormatSecondary?: string;
    yAxisTitleSecondary: string;
    yAxisBounds: [number | undefined | null, number | undefined | null];
    yAxisBoundsSecondary: [number | undefined | null, number | undefined | null];
    xAxisTimeFormat?: string;
    truncateYAxis: boolean;
    truncateYAxisSecondary: boolean;
    timeGrainSqla?: TimeGranularity;
    tooltipTimeFormat?: string;
    zoomable: boolean;
    richTooltip: boolean;
    xAxisLabelRotation: number;
    colorScheme?: string;
    area: boolean;
    areaB: boolean;
    contributionMode?: EchartsTimeseriesContributionType;
    contributionModeB?: EchartsTimeseriesContributionType;
    markerEnabled: boolean;
    markerEnabledB: boolean;
    markerSize: number;
    markerSizeB: number;
    opacity: number;
    opacityB: number;
    orderDesc: boolean;
    orderDescB: boolean;
    rowLimit: number;
    rowLimitB: number;
    seriesType: EchartsTimeseriesSeriesType;
    seriesTypeB: EchartsTimeseriesSeriesType;
    showValue: boolean;
    showValueB: boolean;
    stack: boolean;
    stackB: boolean;
    yAxisIndex?: number;
    yAxisIndexB?: number;
    groupby: QueryFormColumn[];
    groupbyB: QueryFormColumn[];
    emitFilter: boolean;
} & EchartsLegendFormData & EchartsTitleFormData;
export declare const DEFAULT_FORM_DATA: EchartsMixedTimeseriesFormData;
export interface EchartsMixedTimeseriesProps extends ChartProps {
    formData: EchartsMixedTimeseriesFormData;
    queriesData: ChartDataResponseResult[];
}
export declare type EchartsMixedTimeseriesChartTransformedProps = {
    formData: EchartsMixedTimeseriesFormData;
    height: number;
    width: number;
    echartOptions: EChartsCoreOption;
    emitFilter: boolean;
    emitFilterB: boolean;
    setDataMask: SetDataMaskHook;
    groupby: QueryFormColumn[];
    groupbyB: QueryFormColumn[];
    labelMap: Record<string, DataRecordValue[]>;
    labelMapB: Record<string, DataRecordValue[]>;
    selectedValues: Record<number, string>;
    seriesBreakdown: number;
};
//# sourceMappingURL=types.d.ts.map