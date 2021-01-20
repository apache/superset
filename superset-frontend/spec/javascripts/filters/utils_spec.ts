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
  getRangeExtraFormData,
  getSelectExtraFormData,
} from '../../../src/filters/utils';

describe('Filter utils', () => {
  describe('getRangeExtraFormData', () => {
    it('getRangeExtraFormData - col: "testCol", lower: 1, upper: 2', () => {
      expect(getRangeExtraFormData('testCol', 1, 2)).toEqual({
        append_form_data: {
          filters: [
            {
              col: 'testCol',
              op: '>=',
              val: 1,
            },
            {
              col: 'testCol',
              op: '<=',
              val: 2,
            },
          ],
        },
      });
    });
    it('getRangeExtraFormData - col: "testCol", lower: 0, upper: 0', () => {
      expect(getRangeExtraFormData('testCol', 0, 0)).toEqual({
        append_form_data: {
          filters: [
            {
              col: 'testCol',
              op: '>=',
              val: 0,
            },
            {
              col: 'testCol',
              op: '<=',
              val: 0,
            },
          ],
        },
      });
    });
    it('getRangeExtraFormData - col: "testCol", lower: null, upper: 2', () => {
      expect(getRangeExtraFormData('testCol', null, 2)).toEqual({
        append_form_data: {
          filters: [
            {
              col: 'testCol',
              op: '<=',
              val: 2,
            },
          ],
        },
      });
    });
    it('getRangeExtraFormData - col: "testCol", lower: 1, upper: undefined', () => {
      expect(getRangeExtraFormData('testCol', 1, undefined)).toEqual({
        append_form_data: {
          filters: [
            {
              col: 'testCol',
              op: '>=',
              val: 1,
            },
          ],
        },
      });
    });
  });
  describe('getSelectExtraFormData', () => {
    it('getSelectExtraFormData - col: "testCol", value: ["value"], emptyFilter: false, inverseSelection: false', () => {
      expect(
        getSelectExtraFormData('testCol', ['value'], false, false),
      ).toEqual({
        append_form_data: {
          filters: [
            {
              col: 'testCol',
              op: 'IN',
              val: ['value'],
            },
          ],
        },
      });
    });
    it('getSelectExtraFormData - col: "testCol", value: ["value"], emptyFilter: true, inverseSelection: false', () => {
      expect(getSelectExtraFormData('testCol', ['value'], true, false)).toEqual(
        {
          append_form_data: {
            extras: {
              where: '1 = 0',
            },
          },
        },
      );
    });
    it('getSelectExtraFormData - col: "testCol", value: ["value"], emptyFilter: false, inverseSelection: true', () => {
      expect(getSelectExtraFormData('testCol', ['value'], false, true)).toEqual(
        {
          append_form_data: {
            filters: [
              {
                col: 'testCol',
                op: 'NOT IN',
                val: ['value'],
              },
            ],
          },
        },
      );
    });
    it('getSelectExtraFormData - col: "testCol", value: [], emptyFilter: false, inverseSelection: false', () => {
      expect(getSelectExtraFormData('testCol', [], false, false)).toEqual({
        append_form_data: {
          filters: [],
        },
      });
    });
    it('getSelectExtraFormData - col: "testCol", value: undefined, emptyFilter: false, inverseSelection: false', () => {
      expect(
        getSelectExtraFormData('testCol', undefined, false, false),
      ).toEqual({
        append_form_data: {
          filters: [],
        },
      });
    });
    it('getSelectExtraFormData - col: "testCol", value: null, emptyFilter: false, inverseSelection: false', () => {
      expect(getSelectExtraFormData('testCol', null, false, false)).toEqual({
        append_form_data: {
          filters: [],
        },
      });
    });
  });
});
