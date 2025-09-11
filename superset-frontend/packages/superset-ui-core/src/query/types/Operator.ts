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

/** List of operators that do not require another operand */
const UNARY_OPERATORS = ['IS NOT NULL', 'IS NULL'] as const;

/** List of operators that require another operand that is a single value */
const BINARY_OPERATORS = [
  '==',
  '!=',
  '>',
  '<',
  '>=',
  '<=',
  'ILIKE',
  'LIKE',
  'NOT LIKE',
  'REGEX',
  'TEMPORAL_RANGE',
] as const;

/** List of operators that require another operand that is a set */
const SET_OPERATORS = ['IN', 'NOT IN'] as const;

//---------------------------------------------------
// Derived types
//---------------------------------------------------

/** An operator that does not require another operand */
export type UnaryOperator = (typeof UNARY_OPERATORS)[number];

/** An operator that requires another operand that is a single value */
export type BinaryOperator = (typeof BINARY_OPERATORS)[number];

/** An operator that require another operand that is a set */
export type SetOperator = (typeof SET_OPERATORS)[number];

//---------------------------------------------------
// Type guards
//---------------------------------------------------

const unaryOperatorSet = new Set<string>(UNARY_OPERATORS);

export function isUnaryOperator(operator: string): operator is UnaryOperator {
  return unaryOperatorSet.has(operator);
}

const binaryOperatorSet = new Set<string>(BINARY_OPERATORS);

export function isBinaryOperator(operator: string): operator is BinaryOperator {
  return binaryOperatorSet.has(operator);
}

const setOperatorSet = new Set<string>(SET_OPERATORS);

export function isSetOperator(operator: string): operator is SetOperator {
  return setOperatorSet.has(operator);
}
