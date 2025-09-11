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
import type { OptionName } from 'echarts/types/src/util/types';
import type { TreeSeriesNodeItemOption } from 'echarts/types/src/chart/tree/TreeSeries';
import { ChartDataResponseResult, QueryFormData } from '@superset-ui/core';
import { BaseChartProps, BaseTransformedProps } from '../types';

export type EchartsTreeFormData = QueryFormData & {
  id: string;
  parent: string;
  name: string;
  rootNodeId?: string | number;
  orient: 'LR' | 'RL' | 'TB' | 'BT';
  symbol: string;
  symbolSize: number;
  colorScheme?: string;
  metric?: string;
  layout: 'orthogonal' | 'radial';
  roam: boolean | 'scale' | 'move';
  nodeLabelPosition: 'top' | 'bottom' | 'left' | 'right';
  childLabelPosition: 'top' | 'bottom' | 'left' | 'right';
  emphasis: 'none' | 'ancestor' | 'descendant';
};

export interface TreeChartDataResponseResult extends ChartDataResponseResult {
  data: TreeDataRecord[];
}

export interface EchartsTreeChartProps
  extends BaseChartProps<EchartsTreeFormData> {
  formData: EchartsTreeFormData;
  queriesData: TreeChartDataResponseResult[];
}

export type TreeDataRecord = Record<string, OptionName> & {
  children?: TreeSeriesNodeItemOption[];
};

export type TreeTransformedProps = BaseTransformedProps<EchartsTreeFormData>;
