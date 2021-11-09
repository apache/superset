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

import getProcessDataFunction from '../src/processData';

describe('processData', () => {
  const processData = getProcessDataFunction();
  const timeseriesLimitMetric = 'a';
  const orderDesc = true;
  const records = [
    {
      a: 1,
      b: 1,
      c: 3,
    },
    {
      a: 2,
      b: 1,
      c: 2,
    },
    {
      a: 3,
      b: 1,
      c: 1,
    },
  ];
  const metrics = ['a', 'b', 'c'];

  it('returns sorted result', () => {
    const result = processData({
      timeseriesLimitMetric,
      orderDesc,
      records,
      metrics,
    });
    const maxValue = Math.max(...records.map(r => r[timeseriesLimitMetric]));
    const minValue = Math.min(...records.map(r => r[timeseriesLimitMetric]));
    expect(result[0].data[timeseriesLimitMetric]).toEqual(maxValue);
    expect(result[result.length - 1].data[timeseriesLimitMetric]).toEqual(
      minValue,
    );
  });

  it('removes the timeseriesLimitMetric column if it is not included in metrics', () => {
    const filteredMetrics = metrics.filter(
      metric => metric !== timeseriesLimitMetric,
    );
    const result = processData({
      timeseriesLimitMetric,
      orderDesc,
      records,
      metrics: filteredMetrics,
    });
    result.forEach(row => {
      expect(row.data).toEqual(
        expect.not.objectContaining({
          [timeseriesLimitMetric]: expect(Number),
        }),
      );
    });
  });
});
