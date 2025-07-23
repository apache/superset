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
import { ControlComponentProps } from '@superset-ui/chart-controls';

export type ZoomConfigs = ZoomConfigsFixed | ZoomConfigsLinear | ZoomConfigsExp;

export type ChartSizeValues = {
  [index: number]: { width: number; height: number };
};

export interface ZoomConfigsBase {
  type: string;
  configs: {
    zoom: number;
    width: number;
    height: number;
    slope?: number;
    exponent?: number;
  };
  values: ChartSizeValues;
}

export interface ZoomConfigsFixed extends ZoomConfigsBase {
  type: 'FIXED';
}

export interface ZoomConfigsLinear extends ZoomConfigsBase {
  type: 'LINEAR';
  configs: {
    zoom: number;
    width: number;
    height: number;
    slope: number;
    exponent?: number;
  };
}

export interface ZoomConfigsExp extends ZoomConfigsBase {
  type: 'EXP';
  configs: {
    zoom: number;
    width: number;
    height: number;
    slope?: number;
    exponent: number;
  };
}

export type ZoomConfigsControlProps = ControlComponentProps<ZoomConfigs>;

export interface CreateDragGraphicOptions {
  data: number[][];
  onWidthDrag: (...arg: any[]) => any;
  onHeightDrag: (...args: any[]) => any;
  barWidth: number;
  chart: any;
}

export interface CreateDragGraphicOption {
  dataItem: number[];
  dataItemIndex: number;
  dataIndex: number;
  onDrag: (...arg: any[]) => any;
  barWidth: number;
  chart: any;
  add: boolean;
}

export interface GetDragGraphicPositionOptions {
  chart: any;
  x: number;
  y: number;
  barWidth: number;
  add: boolean;
}

export type ZoomConfigsChartProps = ZoomConfigsControlProps;
