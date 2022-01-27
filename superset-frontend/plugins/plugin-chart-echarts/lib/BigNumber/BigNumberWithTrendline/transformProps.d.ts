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
import { NumberFormatter, TimeFormatter } from '@superset-ui/core';
import { EChartsCoreOption } from 'echarts';
import { BigNumberWithTrendlineChartProps, TimeSeriesDatum } from '../types';
export declare function renderTooltipFactory(formatDate?: TimeFormatter, formatValue?: NumberFormatter | TimeFormatter): (params: {
    data: TimeSeriesDatum;
}[]) => string;
export default function transformProps(chartProps: BigNumberWithTrendlineChartProps): {
    width: number;
    height: number;
    bigNumber: number | null;
    bigNumberFallback: (number | null)[] | undefined;
    className: string;
    headerFormatter: NumberFormatter | TimeFormatter;
    formatTime: TimeFormatter;
    headerFontSize: any;
    subheaderFontSize: any;
    mainColor: string;
    showTimestamp: any;
    showTrendLine: any;
    startYAxisAtZero: any;
    subheader: any;
    timestamp: number | null;
    trendLineData: (number | null)[][] | undefined;
    echartOptions: EChartsCoreOption;
};
//# sourceMappingURL=transformProps.d.ts.map