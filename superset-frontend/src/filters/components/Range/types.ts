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
import {
  Behavior,
  DataRecord,
  FilterState,
  QueryFormData,
} from '@superset-ui/core';
import { RefObject } from 'react';
import { PluginFilterHooks, PluginFilterStylesProps } from '../types';

interface PluginFilterRangeCustomizeProps {
  max?: number;
  min?: number;
  stepSize: number;
  logScale?: boolean;
  scaling: string;
}

export type PluginFilterRangeQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterRangeCustomizeProps;

export type PluginFilterRangeProps = PluginFilterStylesProps & {
  data: DataRecord[];
  formData: PluginFilterRangeQueryFormData;
  filterState: FilterState;
  behaviors: Behavior[];
  inputRef: RefObject<any>;
} & PluginFilterHooks;

export enum PluginFilterRangeScalingFunctions {
  LINEAR = 'LINEAR',
  LOG = 'LOG',
  SQRT = 'SQRT',
  CBRT = 'CBRT',
  QDRT = 'QDRT',
  SQUARED = 'SQUARED',
}

export interface PluginFilterRangeScalingFunction {
  display: string;
  transformScale: (val: number | null) => number | null;
  inverseScale: (val: number | null) => number | null;
}

export const SCALING_FUNCTION_ENUM_TO_SCALING_FUNCTION: {
  [key in PluginFilterRangeScalingFunctions]: PluginFilterRangeScalingFunction;
} = {
  [PluginFilterRangeScalingFunctions.LINEAR]: {
    display: 'Linear',
    transformScale: (val: number | null) => val,
    inverseScale: (val: number | null) => val,
  },
  [PluginFilterRangeScalingFunctions.LOG]: {
    display: 'Log Base 10',
    transformScale: (val: number | null) =>
      val ? (val > 0 ? Math.log10(val + 1) : 0) : val,
    inverseScale: (val: number | null) => (val ? Math.pow(10, val) - 1 : val),
  },
  [PluginFilterRangeScalingFunctions.SQRT]: {
    display: 'Square Root',
    transformScale: (val: number | null) =>
      val ? (val > 0 ? Math.sqrt(val) : 0) : val,
    inverseScale: (val: number | null) => (val ? Math.pow(val, 2) : val),
  },
  [PluginFilterRangeScalingFunctions.CBRT]: {
    display: 'Cube Root',
    transformScale: (val: number | null) =>
      val ? (val > 0 ? Math.cbrt(val) : 0) : val,
    inverseScale: (val: number | null) => (val ? Math.pow(val, 3) : val),
  },
  [PluginFilterRangeScalingFunctions.QDRT]: {
    display: 'Quad Root',
    transformScale: (val: number | null) =>
      val ? (val > 0 ? Math.pow(val, 1 / 4) : 0) : val,
    inverseScale: (val: number | null) => (val ? Math.pow(val, 4) : val),
  },
  [PluginFilterRangeScalingFunctions.SQUARED]: {
    display: 'Squared',
    transformScale: (val: number | null) => (val ? Math.pow(val, 2) : val),
    inverseScale: (val: number | null) =>
      val ? (val > 0 ? Math.sqrt(val) : 0) : val,
  },
};
