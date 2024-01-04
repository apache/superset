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
  AdhocFilter,
  isFreeFormAdhocFilter,
  isSimpleAdhocFilter,
  SimpleAdhocFilter,
} from '@superset-ui/core';
import {
  OPERATOR_ENUM_TO_OPERATOR_TYPE,
  Operators,
} from 'src/explore/constants';
import { getSimpleSQLExpression } from 'src/explore/exploreUtils';

export const OPERATORS_TO_SQL = {
  '==': '=',
  '!=': '<>',
  '>': '>',
  '<': '<',
  '>=': '>=',
  '<=': '<=',
  IN: 'IN',
  'NOT IN': 'NOT IN',
  LIKE: 'LIKE',
  ILIKE: 'ILIKE',
  REGEX: 'REGEX',
  'IS NOT NULL': 'IS NOT NULL',
  'IS NULL': 'IS NULL',
  'IS TRUE': 'IS TRUE',
  'IS FALSE': 'IS FALSE',
  'LATEST PARTITION': ({
    datasource,
  }: {
    datasource: { schema: string; datasource_name: string };
  }) =>
    `= '{{ presto.latest_partition('${datasource.schema}.${datasource.datasource_name}') }}'`,
};

export const translateToSql = (
  adhocFilter: AdhocFilter,
  { useSimple }: { useSimple: boolean } = { useSimple: false },
) => {
  if (isSimpleAdhocFilter(adhocFilter) || useSimple) {
    const { subject, operator } = adhocFilter as SimpleAdhocFilter;
    const comparator =
      'comparator' in adhocFilter ? adhocFilter.comparator : undefined;
    const op =
      operator &&
      // 'LATEST PARTITION' supported callback only
      operator ===
        OPERATOR_ENUM_TO_OPERATOR_TYPE[Operators.LATEST_PARTITION].operation
        ? OPERATORS_TO_SQL[operator](adhocFilter)
        : OPERATORS_TO_SQL[operator];
    return getSimpleSQLExpression(subject, op, comparator);
  }
  if (isFreeFormAdhocFilter(adhocFilter)) {
    return adhocFilter.sqlExpression;
  }
  return '';
};
