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
import getChartIdsFromLayout from '../../../../src/dashboard/util/getChartIdsFromLayout';
import {
  ROW_TYPE,
  CHART_TYPE,
} from '../../../../src/dashboard/util/componentTypes';

describe('getChartIdsFromLayout', () => {
  const mockLayout = {
    a: {
      id: 'a',
      type: CHART_TYPE,
      meta: { chartId: 'A' },
    },
    b: {
      id: 'b',
      type: CHART_TYPE,
      meta: { chartId: 'B' },
    },
    c: {
      id: 'c',
      type: ROW_TYPE,
      meta: { chartId: 'C' },
    },
  };

  it('should return an array of chartIds', () => {
    const result = getChartIdsFromLayout(mockLayout);
    expect(Array.isArray(result)).toBe(true);
    expect(result.includes('A')).toBe(true);
    expect(result.includes('B')).toBe(true);
  });

  it('should return ids only from CHART_TYPE components', () => {
    const result = getChartIdsFromLayout(mockLayout);
    expect(result).toHaveLength(2);
    expect(result.includes('C')).toBe(false);
  });
});
