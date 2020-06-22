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
import getFilterConfigsFromFormdata from 'src/dashboard/util/getFilterConfigsFromFormdata';

describe('getFilterConfigsFromFormdata', () => {
  const testFormdata = {
    filter_configs: [
      {
        asc: true,
        clearable: true,
        column: 'state',
        defaultValue: 'CA',
        key: 'fvwncPjUf',
        multiple: true,
      },
    ],
    date_filter: true,
    granularity_sqla: '__time',
    time_grain_sqla: 'P1M',
    time_range: '2018-12-30T00:00:00+:+last+saturday',
  };

  it('should add time grain', () => {
    const result = getFilterConfigsFromFormdata({
      ...testFormdata,
      show_sqla_time_granularity: true,
    });
    expect(result.columns).toMatchObject({
      __time_grain: testFormdata.time_grain_sqla,
    });
  });

  it('should add time column', () => {
    const result = getFilterConfigsFromFormdata({
      ...testFormdata,
      show_sqla_time_column: true,
    });
    expect(result.columns).toMatchObject({
      __time_col: testFormdata.granularity_sqla,
    });
  });

  it('should use default value from form_data', () => {
    const result = getFilterConfigsFromFormdata({
      ...testFormdata,
      show_sqla_time_column: true,
    });
    expect(result.columns).toMatchObject({
      state: ['CA'],
    });
  });

  it('should read multi values from form_data', () => {
    const result = getFilterConfigsFromFormdata({
      ...testFormdata,
      filter_configs: [
        {
          asc: true,
          clearable: true,
          column: 'state',
          defaultValue: 'CA;NY',
          key: 'fvwncPjUf',
          multiple: true,
        },
      ],
    });
    expect(result.columns).toMatchObject({
      state: ['CA', 'NY'],
    });
  });
});
