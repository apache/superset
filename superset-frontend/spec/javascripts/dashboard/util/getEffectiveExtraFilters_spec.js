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
import getEffectiveExtraFilters from 'src/dashboard/util/charts/getEffectiveExtraFilters';

describe('getEffectiveExtraFilters', () => {
  it('should create valid filters', () => {
    const result = getEffectiveExtraFilters({
      gender: ['girl'],
      name: null,
      __time_range: ' : 2020-07-17T00:00:00',
    });
    expect(result).toMatchObject([
      {
        col: 'gender',
        op: 'in',
        val: ['girl'],
      },
      {
        col: '__time_range',
        op: '=',
        val: ' : 2020-07-17T00:00:00',
      },
    ]);
  });
});
