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
const UNARY_OPERATORS = ['IS NOT NULL', 'IS NULL'];
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
    'REGEX',
];
/** List of operators that require another operand that is a set */
const SET_OPERATORS = ['IN', 'NOT IN'];
//---------------------------------------------------
// Type guards
//---------------------------------------------------
const unaryOperatorSet = new Set(UNARY_OPERATORS);
export function isUnaryOperator(operator) {
    return unaryOperatorSet.has(operator);
}
const binaryOperatorSet = new Set(BINARY_OPERATORS);
export function isBinaryOperator(operator) {
    return binaryOperatorSet.has(operator);
}
const setOperatorSet = new Set(SET_OPERATORS);
export function isSetOperator(operator) {
    return setOperatorSet.has(operator);
}
//# sourceMappingURL=Operator.js.map