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
import { TimeseriesDataRecord, NumberFormatter } from '@superset-ui/core';
import { CallbackDataParams, OptionName } from 'echarts/types/src/util/types';
import { TooltipMarker } from 'echarts/types/src/util/format';
import { ForecastSeriesContext, ForecastSeriesEnum, ProphetValue } from '../types';
export declare const extractForecastSeriesContext: (seriesName: OptionName) => ForecastSeriesContext;
export declare const extractForecastSeriesContexts: (seriesNames: string[]) => {
    [key: string]: ForecastSeriesEnum[];
};
export declare const extractProphetValuesFromTooltipParams: (params: (CallbackDataParams & {
    seriesId: string;
})[]) => Record<string, ProphetValue>;
export declare const formatProphetTooltipSeries: ({ seriesName, observation, forecastTrend, forecastLower, forecastUpper, marker, formatter, }: ProphetValue & {
    seriesName: string;
    marker: TooltipMarker;
    formatter: NumberFormatter;
}) => string;
export declare function rebaseTimeseriesDatum(data: TimeseriesDataRecord[], verboseMap?: Record<string, string>): TimeseriesDataRecord[];
//# sourceMappingURL=prophet.d.ts.map