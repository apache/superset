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
  isUnaryAdhocFilter,
  isBinaryAdhocFilter,
  isSetAdhocFilter,
} from '@superset-ui/core/src/query/types/Filter';

describe('Filter type guards', () => {
  describe('isUnaryAdhocFilter', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isUnaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IS NOT NULL',
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isUnaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: '==',
          comparator: 'matcha',
        }),
      ).toEqual(false);
    });
  });

  describe('isBinaryAdhocFilter', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isBinaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: '!=',
          comparator: 'matcha',
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isBinaryAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IS NOT NULL',
        }),
      ).toEqual(false);
    });
  });

  describe('isSetAdhocFilter', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isSetAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IN',
          comparator: ['hojicha', 'earl grey'],
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isSetAdhocFilter({
          expressionType: 'SIMPLE',
          clause: 'WHERE',
          subject: 'tea',
          operator: 'IS NOT NULL',
        }),
      ).toEqual(false);
    });
  });
});
