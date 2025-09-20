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

import { AggregateOption } from './aggregateOptionType';

test('AggregateOption type should enforce aggregate_name as string', () => {
  // Test that the type can be properly used
  const validAggregate: AggregateOption = {
    aggregate_name: 'SUM',
  };

  expect(typeof validAggregate.aggregate_name).toBe('string');
  expect(validAggregate.aggregate_name).toBe('SUM');
});

test('AggregateOption should work with various aggregate names', () => {
  const aggregates: AggregateOption[] = [
    { aggregate_name: 'COUNT' },
    { aggregate_name: 'AVG' },
    { aggregate_name: 'MIN' },
    { aggregate_name: 'MAX' },
  ];

  aggregates.forEach(aggregate => {
    expect(typeof aggregate.aggregate_name).toBe('string');
    expect(aggregate.aggregate_name.length).toBeGreaterThan(0);
  });
});
