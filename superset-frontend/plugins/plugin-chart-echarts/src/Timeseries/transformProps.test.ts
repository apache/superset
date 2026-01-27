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
import transformProps from './transformProps';
import { mockedTimeSeriesProps } from 'spec/fixtures/mockTimeSeries';

describe('Timeseries transformProps', () => {
  it('Should transform props correctly', () => {
    const result = transformProps(mockedTimeSeriesProps);

    expect(result.coltypeMapping).toEqual({
      'SUM(money_for_learning)': 0,
      'SUM(money_for_learning), 1 day ago': 0,
      'SUM(money_for_learning), 1 week ago': 0,
      'SUM(money_for_learning), 1 year ago': 1,
      testing_count: 0,
      'testing_count, 1 day ago': 0,
      'testing_count, 1 week ago': 0,
      'testing_count, 1 year ago': 1,
      time_start: 2,
    });

    const expectedResult = [
      'SUM(money_for_learning)',
      'SUM(money_for_learning), 1 day ago',
      'SUM(money_for_learning), 1 week ago',
      'SUM(money_for_learning), 1 year ago',
      'Testing count',
      'Testing count, 1 day ago',
      'Testing count, 1 week ago',
      'Testing count, 1 year ago',
      'time_start',
    ];

    const legendData = (result.echartOptions.legend as { data: string[] }).data;

    legendData.sort((a, b) => a.localeCompare(b));
    expectedResult.sort((a, b) => a.localeCompare(b));

    expect(legendData).toEqual(expectedResult);
  });
});
