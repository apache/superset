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
import { GraphNodeItemOption } from 'echarts/types/src/chart/graph/GraphSeries';
import { SeriesTooltipOption } from 'echarts/types/src/util/types';
import { EchartsLegendFormData } from '../types';
export declare type EdgeSymbol = 'none' | 'circle' | 'arrow';
export declare type EchartsGraphFormData = EchartsLegendFormData & {
    source: string;
    target: string;
    sourceCategory?: string;
    targetCategory?: string;
    colorScheme?: string;
    metric?: string;
    layout?: 'none' | 'circular' | 'force';
    roam: boolean | 'scale' | 'move';
    draggable: boolean;
    selectedMode?: boolean | 'multiple' | 'single';
    showSymbolThreshold: number;
    repulsion: number;
    gravity: number;
    baseNodeSize: number;
    baseEdgeWidth: number;
    edgeLength: number;
    edgeSymbol: string;
    friction: number;
};
export declare type EChartGraphNode = Omit<GraphNodeItemOption, 'value'> & {
    value: number;
    tooltip?: Pick<SeriesTooltipOption, 'formatter'>;
};
export declare const DEFAULT_FORM_DATA: EchartsGraphFormData;
export declare type tooltipFormatParams = {
    data: {
        [name: string]: string;
    };
};
//# sourceMappingURL=types.d.ts.map