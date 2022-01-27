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
import { ChartDataResponseResult, DataRecord, DataRecordValue, GenericDataType, NumberFormatter, TimeFormatter, TimeseriesDataRecord } from '@superset-ui/core';
import { LegendComponentOption, SeriesOption } from 'echarts';
import { LegendOrientation, LegendType } from '../types';
export declare function extractTimeseriesSeries(data: TimeseriesDataRecord[], opts?: {
    fillNeighborValue?: number;
}): SeriesOption[];
export declare function formatSeriesName(name: DataRecordValue | undefined, { numberFormatter, timeFormatter, coltype, }?: {
    numberFormatter?: NumberFormatter;
    timeFormatter?: TimeFormatter;
    coltype?: GenericDataType;
}): string;
export declare const getColtypesMapping: ({ coltypes, colnames, }: ChartDataResponseResult) => Record<string, GenericDataType>;
export declare function extractGroupbyLabel({ datum, groupby, numberFormatter, timeFormatter, coltypeMapping, }: {
    datum?: DataRecord;
    groupby?: string[] | null;
    numberFormatter?: NumberFormatter;
    timeFormatter?: TimeFormatter;
    coltypeMapping: Record<string, GenericDataType>;
}): string;
export declare function getLegendProps(type: LegendType, orientation: LegendOrientation, show: boolean, zoomable?: boolean): LegendComponentOption | LegendComponentOption[];
export declare function getChartPadding(show: boolean, orientation: LegendOrientation, margin?: string | number | null, padding?: {
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
}): {
    bottom: number;
    left: number;
    right: number;
    top: number;
};
export declare function dedupSeries(series: SeriesOption[]): SeriesOption[];
export declare function sanitizeHtml(text: string): string;
export declare const currentSeries: {
    name: string;
    legend: string;
};
//# sourceMappingURL=series.d.ts.map