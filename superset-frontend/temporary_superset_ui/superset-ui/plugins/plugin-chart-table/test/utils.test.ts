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
import { extractTimeseriesLimitMetric } from '../src/utils/extractOrderby';

describe('utils', () => {
  it('should add post-processing in aggregate mode', () => {
    expect(extractTimeseriesLimitMetric(undefined)).toEqual([]);
    expect(extractTimeseriesLimitMetric(null)).toEqual([]);
    expect(extractTimeseriesLimitMetric([])).toEqual([]);
    expect(extractTimeseriesLimitMetric('my_metric')).toEqual(['my_metric']);
    expect(extractTimeseriesLimitMetric(['my_metric'])).toEqual(['my_metric']);
    expect(extractTimeseriesLimitMetric(['my_metric_1', 'my_metric_2'])).toEqual([
      'my_metric_1',
      'my_metric_2',
    ]);
  });
});
