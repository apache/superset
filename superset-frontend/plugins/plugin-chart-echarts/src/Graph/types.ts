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
import { QueryFormData } from '@superset-ui/core';
import type { GraphNodeItemOption } from 'echarts/types/src/chart/graph/GraphSeries';
import type { SeriesTooltipOption } from 'echarts/types/src/util/types';
import {
  BaseChartProps,
  BaseTransformedProps,
  ContextMenuTransformedProps,
  LegendFormData,
  LegendOrientation,
  LegendType,
} from '../types';
import { DEFAULT_LEGEND_FORM_DATA } from '../constants';

export type EdgeSymbol = 'none' | 'circle' | 'arrow';

export type EchartsGraphFormData = QueryFormData &
  LegendFormData & {
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

export type EChartGraphNode = Omit<GraphNodeItemOption, 'value'> & {
  value: number;
  col: string;
  tooltip?: Pick<SeriesTooltipOption, 'formatter'>;
};

// @ts-ignore
export const DEFAULT_FORM_DATA: EchartsGraphFormData = {
  ...DEFAULT_LEGEND_FORM_DATA,
  source: '',
  target: '',
  layout: 'force',
  roam: true,
  draggable: false,
  selectedMode: 'single',
  showSymbolThreshold: 0,
  repulsion: 1000,
  gravity: 0.3,
  edgeSymbol: 'none,arrow',
  edgeLength: 400,
  baseEdgeWidth: 3,
  baseNodeSize: 20,
  friction: 0.2,
  legendOrientation: LegendOrientation.Top,
  legendType: LegendType.Scroll,
};

export type tooltipFormatParams = {
  data: { [name: string]: string };
};

export interface EchartsGraphChartProps
  extends BaseChartProps<EchartsGraphFormData> {
  formData: EchartsGraphFormData;
}

export type GraphChartTransformedProps =
  BaseTransformedProps<EchartsGraphFormData> & ContextMenuTransformedProps;
