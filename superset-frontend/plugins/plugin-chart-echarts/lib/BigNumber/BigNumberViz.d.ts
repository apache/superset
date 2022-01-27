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
import React from 'react';
import { NumberFormatter, TimeFormatter } from '@superset-ui/core';
import { EChartsCoreOption } from 'echarts';
import { TimeSeriesDatum } from './types';
declare type BigNumberVisProps = {
    className?: string;
    width: number;
    height: number;
    bigNumber?: number | null;
    bigNumberFallback?: TimeSeriesDatum;
    headerFormatter: NumberFormatter | TimeFormatter;
    formatTime: TimeFormatter;
    headerFontSize: number;
    kickerFontSize: number;
    subheader: string;
    subheaderFontSize: number;
    showTimestamp?: boolean;
    showTrendLine?: boolean;
    startYAxisAtZero?: boolean;
    timeRangeFixed?: boolean;
    timestamp?: number;
    trendLineData?: TimeSeriesDatum[];
    mainColor: string;
    echartOptions: EChartsCoreOption;
};
declare class BigNumberVis extends React.PureComponent<BigNumberVisProps> {
    static defaultProps: {
        className: string;
        headerFormatter: NumberFormatter;
        formatTime: TimeFormatter;
        headerFontSize: number;
        kickerFontSize: number;
        mainColor: string;
        showTimestamp: boolean;
        showTrendLine: boolean;
        startYAxisAtZero: boolean;
        subheader: string;
        subheaderFontSize: number;
        timeRangeFixed: boolean;
    };
    getClassName(): string;
    createTemporaryContainer(): HTMLDivElement;
    renderFallbackWarning(): JSX.Element | null;
    renderKicker(maxHeight: number): JSX.Element | null;
    renderHeader(maxHeight: number): JSX.Element;
    renderSubheader(maxHeight: number): JSX.Element | null;
    renderTrendline(maxHeight: number): JSX.Element | null;
    render(): JSX.Element;
}
declare const _default: import("@emotion/styled").StyledComponent<Pick<BigNumberVisProps, "width" | "height" | "echartOptions" | "bigNumber" | "bigNumberFallback" | "timestamp" | "trendLineData"> & Partial<Pick<BigNumberVisProps, "className" | "headerFontSize" | "showTimestamp" | "showTrendLine" | "startYAxisAtZero" | "subheader" | "subheaderFontSize" | "timeRangeFixed" | "headerFormatter" | "formatTime" | "kickerFontSize" | "mainColor">> & Partial<Pick<{
    className: string;
    headerFormatter: NumberFormatter;
    formatTime: TimeFormatter;
    headerFontSize: number;
    kickerFontSize: number;
    mainColor: string;
    showTimestamp: boolean;
    showTrendLine: boolean;
    startYAxisAtZero: boolean;
    subheader: string;
    subheaderFontSize: number;
    timeRangeFixed: boolean;
}, never>> & {
    theme?: import("@emotion/react").Theme | undefined;
}, {}, {
    ref?: React.Ref<BigNumberVis> | undefined;
}>;
export default _default;
//# sourceMappingURL=BigNumberViz.d.ts.map