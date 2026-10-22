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
  ExtraFormData,
  QueryObjectFilterClause,
  ensureIsArray,
} from '@superset-ui/core';
import { GenericDataType } from '@apache-superset/core/common';
import { t } from '@apache-superset/core/translation';
import {
  CONDITION_OPERATORS,
  ConditionOperator,
  ConditionScalar,
  ConditionValue,
  SET_CONDITION_OPERATORS,
  UNARY_CONDITION_OPERATORS,
} from './types';

export const isConditionOperator = (op: unknown): op is ConditionOperator =>
  (CONDITION_OPERATORS as readonly unknown[]).includes(op);

export const isUnaryConditionOperator = (op: ConditionOperator) =>
  (UNARY_CONDITION_OPERATORS as readonly string[]).includes(op);

export const isSetConditionOperator = (op: ConditionOperator) =>
  (SET_CONDITION_OPERATORS as readonly string[]).includes(op);

const isBlank = (val: unknown) =>
  val === undefined || val === null || val === '';

/**
 * Operators that make sense for a column's generic type. The type comes from
 * the filter's own query result, so it follows the column if its type changes
 * in the dataset editor or a semantic layer. An unknown type allows everything
 * and leaves validation to the database.
 */
const OPERATORS_BY_TYPE: Record<GenericDataType, ConditionOperator[]> = {
  [GenericDataType.String]: [
    '==',
    '!=',
    'IN',
    'NOT IN',
    'LIKE',
    'IS NULL',
    'IS NOT NULL',
  ],
  [GenericDataType.Numeric]: [
    '==',
    '!=',
    '>',
    '<',
    '>=',
    '<=',
    'IN',
    'NOT IN',
    'IS NULL',
    'IS NOT NULL',
  ],
  [GenericDataType.Temporal]: [
    '==',
    '!=',
    '>',
    '<',
    '>=',
    '<=',
    'IS NULL',
    'IS NOT NULL',
  ],
  [GenericDataType.Boolean]: ['==', '!=', 'IS NULL', 'IS NOT NULL'],
  [GenericDataType.MultiValue]: ['IS NULL', 'IS NOT NULL'],
};

export function getAllowedOperators(
  coltype?: GenericDataType | null,
): ConditionOperator[] {
  if (coltype === undefined || coltype === null) {
    return [...CONDITION_OPERATORS];
  }
  return OPERATORS_BY_TYPE[coltype] ?? [...CONDITION_OPERATORS];
}

/**
 * A condition is complete when it has everything needed to build a clause:
 * unary operators need nothing, set operators need at least one value and
 * every other operator needs a single non-blank value.
 */
export function isConditionComplete(
  value?: ConditionValue | null,
): value is ConditionValue {
  if (!value || !isConditionOperator(value.op)) {
    return false;
  }
  if (isUnaryConditionOperator(value.op)) {
    return true;
  }
  if (isSetConditionOperator(value.op)) {
    return ensureIsArray(value.val).some(val => !isBlank(val));
  }
  return !Array.isArray(value.val) && !isBlank(value.val);
}

/**
 * Values typed into the filter arrive as strings. Cast them to numbers for
 * numeric columns so comparisons like `>` behave numerically, and true/false
 * to booleans for boolean columns. LIKE patterns are always left as strings.
 */
export function coerceConditionValue(
  val: ConditionScalar,
  op: ConditionOperator,
  coltype?: GenericDataType,
): ConditionScalar {
  if (
    op !== 'LIKE' &&
    coltype === GenericDataType.Numeric &&
    typeof val === 'string' &&
    val.trim() !== '' &&
    !Number.isNaN(Number(val))
  ) {
    return Number(val);
  }
  if (coltype === GenericDataType.Boolean && typeof val === 'string') {
    const lower = val.trim().toLowerCase();
    if (lower === 'true' || lower === 'false') {
      return lower === 'true';
    }
  }
  return val;
}

const isNumeric = (val: unknown) =>
  typeof val === 'number' ||
  (typeof val === 'string' && val.trim() !== '' && !Number.isNaN(Number(val)));

/**
 * Explains why a condition can't be applied to a column of the given type, or
 * returns null when it can. This catches saved conditions that no longer fit
 * after the column's type changed, so they don't break the charts. Values are
 * only checked once the condition is complete, so an empty input isn't an
 * error.
 */
export function getConditionError(
  value: ConditionValue,
  coltype?: GenericDataType | null,
): string | null {
  const { op } = value;
  if (!getAllowedOperators(coltype).includes(op)) {
    return t('%s is not supported for this column type', op);
  }
  if (
    coltype === GenericDataType.Numeric &&
    isConditionComplete(value) &&
    !isUnaryConditionOperator(op) &&
    !ensureIsArray(value.val).every(isNumeric)
  ) {
    return t('This column is numeric. Please enter a number.');
  }
  return null;
}

export function getConditionExtraFormData(
  col: string,
  value: ConditionValue | null | undefined,
  coltype?: GenericDataType,
): ExtraFormData {
  if (
    !col ||
    !isConditionComplete(value) ||
    getConditionError(value, coltype) !== null
  ) {
    return {};
  }
  const { op } = value;
  if (isUnaryConditionOperator(op)) {
    return { filters: [{ col, op } as QueryObjectFilterClause] };
  }
  if (isSetConditionOperator(op)) {
    const val = ensureIsArray(value.val)
      .filter(item => !isBlank(item))
      .map(item => coerceConditionValue(item as ConditionScalar, op, coltype));
    return { filters: [{ col, op, val } as QueryObjectFilterClause] };
  }
  const val = coerceConditionValue(value.val as ConditionScalar, op, coltype);
  return { filters: [{ col, op, val } as QueryObjectFilterClause] };
}

/** Human readable label, e.g. `price > 100` or `country IN (CA, US)`. */
export function getConditionLabel(
  col: string,
  value: ConditionValue | null | undefined,
): string {
  if (!isConditionComplete(value)) {
    return '';
  }
  const { op } = value;
  if (isUnaryConditionOperator(op)) {
    return `${col} ${op}`;
  }
  if (isSetConditionOperator(op)) {
    return `${col} ${op} (${ensureIsArray(value.val).join(', ')})`;
  }
  return `${col} ${op} ${value.val}`;
}
