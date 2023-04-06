/*
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
  UnaryOperator,
  BinaryOperator,
  SetOperator,
  isUnaryOperator,
  isBinaryOperator,
  isSetOperator,
} from './Operator';
import { TimeGranularity } from '../../time-format';

interface BaseAdhocFilter {
  clause: 'WHERE' | 'HAVING';
  timeGrain?: TimeGranularity;
  isExtra?: boolean;
}

interface BaseSimpleAdhocFilter extends BaseAdhocFilter {
  expressionType: 'SIMPLE';
  subject: string;
}

export type UnaryAdhocFilter = BaseSimpleAdhocFilter & {
  operator: UnaryOperator;
};

export type BinaryAdhocFilter = BaseSimpleAdhocFilter & {
  operator: BinaryOperator;
  comparator: string;
};

export type SetAdhocFilter = BaseSimpleAdhocFilter & {
  operator: SetOperator;
  comparator: string[];
};

export type SimpleAdhocFilter =
  | UnaryAdhocFilter
  | BinaryAdhocFilter
  | SetAdhocFilter;

export interface FreeFormAdhocFilter extends BaseAdhocFilter {
  expressionType: 'SQL';
  sqlExpression: string;
}

export type AdhocFilter = SimpleAdhocFilter | FreeFormAdhocFilter;

//---------------------------------------------------
// Type guards
//---------------------------------------------------

export function isSimpleAdhocFilter(
  filter: AdhocFilter,
): filter is SimpleAdhocFilter {
  return filter.expressionType === 'SIMPLE';
}

export function isFreeFormAdhocFilter(
  filter: AdhocFilter,
): filter is FreeFormAdhocFilter {
  return filter.expressionType === 'SQL';
}

export function isUnaryAdhocFilter(
  filter: SimpleAdhocFilter,
): filter is UnaryAdhocFilter {
  return isUnaryOperator(filter.operator);
}

export function isBinaryAdhocFilter(
  filter: SimpleAdhocFilter,
): filter is BinaryAdhocFilter {
  return isBinaryOperator(filter.operator);
}

export function isSetAdhocFilter(
  filter: SimpleAdhocFilter,
): filter is SetAdhocFilter {
  return isSetOperator(filter.operator);
}
