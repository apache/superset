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
import { convertFilter } from '@superset-ui/core/src/query';

describe('convertFilter', () => {
  it('should handle unary filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'topping',
        operator: 'IS NOT NULL',
      }),
    ).toEqual({
      col: 'topping',
      op: 'IS NOT NULL',
    });
  });

  it('should convert binary filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'topping',
        operator: '==',
        comparator: 'grass jelly',
      }),
    ).toEqual({
      col: 'topping',
      op: '==',
      val: 'grass jelly',
    });
  });

  it('should convert set filter', () => {
    expect(
      convertFilter({
        expressionType: 'SIMPLE',
        clause: 'WHERE',
        subject: 'toppings',
        operator: 'IN',
        comparator: ['boba', 'grass jelly'],
      }),
    ).toEqual({
      col: 'toppings',
      op: 'IN',
      val: ['boba', 'grass jelly'],
    });
  });
});
