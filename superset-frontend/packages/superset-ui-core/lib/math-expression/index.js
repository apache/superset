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
import mexp from 'math-expression-evaluator';
const REPLACE_OPERATORS = [
    [new RegExp(/==/g), 'Eq'],
    [new RegExp(/>=/g), 'Gte'],
    [new RegExp(/<=/g), 'Lte'],
    [new RegExp(/>/g), 'Gt'],
    [new RegExp(/</g), 'Lt'],
];
const TOKENS = [
    {
        type: 3,
        token: 'x',
        show: 'x',
        value: 'x',
    },
    {
        type: 2,
        token: '&',
        show: '&',
        value: (a, b) => a & b,
    },
    {
        type: 2,
        token: '|',
        show: '|',
        value: (a, b) => a | b,
    },
    {
        type: 2,
        token: 'and',
        show: 'and',
        value: (a, b) => a && b,
    },
    {
        type: 2,
        token: 'xor',
        show: 'xor',
        value: (a, b) => a ^ b,
    },
    {
        type: 2,
        token: 'or',
        show: 'or',
        value: (a, b) => Number(a || b),
    },
    {
        type: 2,
        token: 'Eq',
        show: 'Eq',
        value: (a, b) => Number(a === b),
    },
    {
        type: 2,
        token: 'Lt',
        show: 'Lt',
        value: (a, b) => Number(a < b),
    },
    {
        type: 2,
        token: 'Lte',
        show: 'Lte',
        value: (a, b) => Number(a <= b),
    },
    {
        type: 2,
        token: 'Gt',
        show: 'Gt',
        value: (a, b) => Number(a > b),
    },
    {
        type: 2,
        token: 'Gte',
        show: 'Gte',
        value: (a, b) => Number(a >= b),
    },
];
export function evalExpression(expression, value) {
    let parsedExpression = expression;
    // replace `<` with `Lt` (and others) to avoid clashes with builtin function operators
    // that are not needed in Superset.
    REPLACE_OPERATORS.forEach(([key, value]) => {
        parsedExpression = parsedExpression.replace(key, value);
    });
    const subExpressions = String(parsedExpression).split('=');
    parsedExpression = subExpressions[1] ?? subExpressions[0];
    // we can ignore the type requirement on `TOKENS`, as value is always `number`
    // and doesn't need to consider `number | underfined`.
    // @ts-ignore
    return Number(mexp.eval(parsedExpression, TOKENS, { x: value }));
}
export function isValidExpression(expression) {
    try {
        evalExpression(expression, 0);
    }
    catch (err) {
        return false;
    }
    return true;
}
//# sourceMappingURL=index.js.map