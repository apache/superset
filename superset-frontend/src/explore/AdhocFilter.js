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
import { MULTI_OPERATORS, CUSTOM_OPERATORS } from './constants';

export const EXPRESSION_TYPES = {
  SIMPLE: 'SIMPLE',
  SQL: 'SQL',
};

export const CLAUSES = {
  HAVING: 'HAVING',
  WHERE: 'WHERE',
};

const OPERATORS_TO_SQL = {
  '==': '=',
  '!=': '<>',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  in: 'in',
  'not in': 'not in',
  LIKE: 'like',
  regex: 'regex',
  'IS NOT NULL': 'IS NOT NULL',
  'IS NULL': 'IS NULL',
  'LATEST PARTITION': ({ datasource }) => {
    return `= '{{ presto.latest_partition('${datasource.schema}.${datasource.datasource_name}') }}'`;
  },
};

function translateToSql(adhocMetric, { useSimple } = {}) {
  if (adhocMetric.expressionType === EXPRESSION_TYPES.SIMPLE || useSimple) {
    const isMulti = MULTI_OPERATORS.has(adhocMetric.operator);
    const { subject } = adhocMetric;
    const operator =
      adhocMetric.operator && CUSTOM_OPERATORS.has(adhocMetric.operator)
        ? OPERATORS_TO_SQL[adhocMetric.operator](adhocMetric)
        : OPERATORS_TO_SQL[adhocMetric.operator];
    const comparator = Array.isArray(adhocMetric.comparator)
      ? adhocMetric.comparator.join("','")
      : adhocMetric.comparator || '';
    return `${subject} ${operator} ${isMulti ? "('" : ''}${comparator}${
      isMulti ? "')" : ''
    }`;
  }
  if (adhocMetric.expressionType === EXPRESSION_TYPES.SQL) {
    return adhocMetric.sqlExpression;
  }
  return '';
}

export default class AdhocFilter {
  constructor(adhocFilter) {
    this.expressionType = adhocFilter.expressionType || EXPRESSION_TYPES.SIMPLE;
    if (this.expressionType === EXPRESSION_TYPES.SIMPLE) {
      this.subject = adhocFilter.subject;
      this.operator = adhocFilter.operator;
      this.comparator = adhocFilter.comparator;
      this.clause = adhocFilter.clause;
      this.sqlExpression = null;
    } else if (this.expressionType === EXPRESSION_TYPES.SQL) {
      this.sqlExpression =
        typeof adhocFilter.sqlExpression === 'string'
          ? adhocFilter.sqlExpression
          : translateToSql(adhocFilter, { useSimple: true });
      this.clause = adhocFilter.clause;
      if (adhocFilter.operator && CUSTOM_OPERATORS.has(adhocFilter.operator)) {
        this.subject = adhocFilter.subject;
        this.operator = adhocFilter.operator;
      } else {
        this.subject = null;
        this.operator = null;
      }
      this.comparator = null;
    }
    this.isExtra = !!adhocFilter.isExtra;
    this.isNew = !!adhocFilter.isNew;

    this.filterOptionName =
      adhocFilter.filterOptionName ||
      `filter_${Math.random()
        .toString(36)
        .substring(2, 15)}_${Math.random().toString(36).substring(2, 15)}`;
  }

  duplicateWith(nextFields) {
    return new AdhocFilter({
      ...this,
      // all duplicated fields are not new (i.e. will not open popup automatically)
      isNew: false,
      ...nextFields,
    });
  }

  equals(adhocFilter) {
    return (
      adhocFilter.expressionType === this.expressionType &&
      adhocFilter.sqlExpression === this.sqlExpression &&
      adhocFilter.operator === this.operator &&
      adhocFilter.comparator === this.comparator &&
      adhocFilter.subject === this.subject
    );
  }

  isValid() {
    if (this.expressionType === EXPRESSION_TYPES.SIMPLE) {
      if (this.operator === 'IS NOT NULL' || this.operator === 'IS NULL') {
        return !!(this.operator && this.subject);
      }

      if (this.operator && this.subject && this.clause) {
        if (Array.isArray(this.comparator)) {
          if (this.comparator.length > 0) {
            // A non-empty array of values ('IN' or 'NOT IN' clauses)
            return true;
          }
        } else if (this.comparator !== null) {
          // A value has been selected or typed
          return true;
        }
      }
    } else if (this.expressionType === EXPRESSION_TYPES.SQL) {
      return !!(this.sqlExpression && this.clause);
    }
    return false;
  }

  getDefaultLabel() {
    const label = this.translateToSql();
    return label.length < 43 ? label : `${label.substring(0, 40)}...`;
  }

  translateToSql() {
    return translateToSql(this);
  }
}
