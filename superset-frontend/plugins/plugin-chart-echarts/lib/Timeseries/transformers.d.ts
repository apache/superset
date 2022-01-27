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
import { AnnotationData, CategoricalColorScale, EventAnnotationLayer, FilterState, FormulaAnnotationLayer, IntervalAnnotationLayer, NumberFormatter, TimeFormatter, TimeseriesAnnotationLayer, TimeseriesDataRecord } from '@superset-ui/core';
import { SeriesOption } from 'echarts';
import { ForecastSeriesEnum, LegendOrientation } from '../types';
import { EchartsTimeseriesSeriesType } from './types';
export declare function transformSeries(series: SeriesOption, colorScale: CategoricalColorScale, opts: {
    area?: boolean;
    filterState?: FilterState;
    seriesContexts?: {
        [key: string]: ForecastSeriesEnum[];
    };
    markerEnabled?: boolean;
    markerSize?: number;
    areaOpacity?: number;
    seriesType?: EchartsTimeseriesSeriesType;
    stack?: boolean;
    yAxisIndex?: number;
    showValue?: boolean;
    onlyTotal?: boolean;
    formatter?: NumberFormatter;
    totalStackedValues?: number[];
    showValueIndexes?: number[];
    richTooltip?: boolean;
}): SeriesOption | undefined;
export declare function transformFormulaAnnotation(layer: FormulaAnnotationLayer, data: TimeseriesDataRecord[], colorScale: CategoricalColorScale): SeriesOption;
export declare function transformIntervalAnnotation(layer: IntervalAnnotationLayer, data: TimeseriesDataRecord[], annotationData: AnnotationData, colorScale: CategoricalColorScale): SeriesOption[];
export declare function transformEventAnnotation(layer: EventAnnotationLayer, data: TimeseriesDataRecord[], annotationData: AnnotationData, colorScale: CategoricalColorScale): SeriesOption[];
export declare function transformTimeseriesAnnotation(layer: TimeseriesAnnotationLayer, markerSize: number, data: TimeseriesDataRecord[], annotationData: AnnotationData): SeriesOption[];
export declare function getPadding(showLegend: boolean, legendOrientation: LegendOrientation, addYAxisTitleOffset: boolean, zoomable: boolean, margin?: string | number | null, addXAxisTitleOffset?: boolean, yAxisTitlePosition?: string, yAxisTitleMargin?: number, xAxisTitleMargin?: number): {
    bottom: number;
    left: number;
    right: number;
    top: number;
};
export declare function getTooltipTimeFormatter(format?: string): TimeFormatter | StringConstructor;
export declare function getXAxisFormatter(format?: string): TimeFormatter | StringConstructor | undefined;
//# sourceMappingURL=transformers.d.ts.map