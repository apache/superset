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
  AppSection,
  Behavior,
  DataRecord,
  FilterState,
  QueryFormData,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { RefObject } from 'react';
import { PluginFilterHooks, PluginFilterStylesProps } from '../types';
import { FilterBarOrientation } from '../../../dashboard/types';

export const UNARY_CONDITION_OPERATORS = ['IS NULL', 'IS NOT NULL'] as const;
export const SET_CONDITION_OPERATORS = ['IN', 'NOT IN'] as const;
export const BINARY_CONDITION_OPERATORS = [
  '==',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  'LIKE',
] as const;

export const CONDITION_OPERATORS = [
  ...BINARY_CONDITION_OPERATORS,
  ...SET_CONDITION_OPERATORS,
  ...UNARY_CONDITION_OPERATORS,
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

export type ConditionScalar = string | number | boolean;

export interface ConditionValue {
  op: ConditionOperator;
  val?: ConditionScalar | ConditionScalar[] | null;
}

interface PluginFilterConditionCustomizeProps {
  defaultValue?: ConditionValue | null;
  enableEmptyFilter?: boolean;
}

export type PluginFilterConditionQueryFormData = QueryFormData &
  PluginFilterStylesProps &
  PluginFilterConditionCustomizeProps;

export type PluginFilterConditionProps = PluginFilterStylesProps & {
  data: DataRecord[];
  coltype?: GenericDataType;
  formData: PluginFilterConditionQueryFormData;
  filterState: FilterState;
  behaviors: Behavior[];
  inputRef: RefObject<HTMLDivElement>;
  appSection?: AppSection;
  filterBarOrientation?: FilterBarOrientation;
  isOverflowingFilterBar?: boolean;
  clearAllTrigger?: boolean;
  onClearAllComplete?: (filterId: string) => void;
} & PluginFilterHooks;
