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

import { createMultiFormatter } from '@superset-ui/core';

describe('createMultiFormatter()', () => {
  describe('creates a multi-step formatter', () => {
    const formatter = createMultiFormatter({
      id: 'my_format',
      useLocalTime: true,
    });
    it('formats millisecond', () => {
      expect(formatter(new Date(2018, 10, 20, 11, 22, 33, 100))).toEqual(
        '.100',
      );
    });
    it('formats second', () => {
      expect(formatter(new Date(2018, 10, 20, 11, 22, 33))).toEqual(':33');
    });
    it('format minutes', () => {
      expect(formatter(new Date(2018, 10, 20, 11, 22))).toEqual('11:22');
    });
    it('format hours', () => {
      expect(formatter(new Date(2018, 10, 20, 11))).toEqual('11 AM');
    });
    it('format first day of week', () => {
      expect(formatter(new Date(2018, 10, 18))).toEqual('Nov 18');
    });
    it('format other day of week', () => {
      expect(formatter(new Date(2018, 10, 20))).toEqual('Tue 20');
    });
    it('format month', () => {
      expect(formatter(new Date(2018, 10))).toEqual('November');
    });
    it('format year', () => {
      expect(formatter(new Date(2018, 0))).toEqual('2018');
    });
  });
});
