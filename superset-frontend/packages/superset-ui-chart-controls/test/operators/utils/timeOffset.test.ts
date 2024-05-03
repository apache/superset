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
import { getOriginalSeries } from '@superset-ui/chart-controls';

test('returns the series name when time compare is empty', () => {
  const seriesName = 'sum';
  expect(getOriginalSeries(seriesName, [])).toEqual(seriesName);
});

test('returns the original series name', () => {
  const seriesName = 'sum__1_month_ago';
  const timeCompare = ['1_month_ago'];
  expect(getOriginalSeries(seriesName, timeCompare)).toEqual('sum');
});
