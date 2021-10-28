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

import getProcessMetricsFunction from '../src/processMetrics';

describe('processData', () => {
  const processMetrics = getProcessMetricsFunction();
  const records = [
    {
      a: 1,
      '%b': 0.4,
      c: 3,
    },
    {
      a: 2,
      '%b': 0.4,
      c: 2,
    },
    {
      a: 3,
      '%b': 0.2,
      c: 1,
    },
  ];
  const metrics = ['a'];
  const percentMetrics = ['b'];

  it('returns sorted result', () => {
    const result = processMetrics({
      records,
      metrics,
      percentMetrics,
    });
    const expected = ['a', '%b'];
    expect(result).toEqual(expect.arrayContaining(expected));
  });
});
