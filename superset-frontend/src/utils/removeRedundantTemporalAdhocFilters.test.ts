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

import { AdhocFilter } from '@superset-ui/core';
import { removeRedundantTemporalAdhocFilters } from './removeRedundantTemporalAdhocFilters';

it('should remove temporal filter with no value if there is another filter that targets the same column', () => {
  const filters: AdhocFilter[] = [
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'gender',
      operator: '==',
      comparator: 'boy',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'ds',
      operator: 'TEMPORAL_RANGE',
      comparator: 'No filter',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'ds',
      operator: 'TEMPORAL_RANGE',
      comparator: '2 weeks ago',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'name',
      operator: '==',
      comparator: 'John',
    },
  ];

  expect(removeRedundantTemporalAdhocFilters(filters)).toEqual([
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'gender',
      operator: '==',
      comparator: 'boy',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'ds',
      operator: 'TEMPORAL_RANGE',
      comparator: '2 weeks ago',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'name',
      operator: '==',
      comparator: 'John',
    },
  ]);
});

it('should not remove temporal filter with no value if there is no other filter that targets the same column', () => {
  const filters: AdhocFilter[] = [
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'gender',
      operator: '==',
      comparator: 'boy',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'ds',
      operator: 'TEMPORAL_RANGE',
      comparator: 'No filter',
    },
    {
      expressionType: 'SIMPLE',
      clause: 'WHERE',
      subject: 'name',
      operator: '==',
      comparator: 'John',
    },
  ];

  expect(removeRedundantTemporalAdhocFilters(filters)).toEqual(filters);
});
