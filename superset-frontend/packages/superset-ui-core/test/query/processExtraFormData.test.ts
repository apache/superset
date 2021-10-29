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
import { overrideExtraFormData } from '@superset-ui/core/src/query/processExtraFormData';

describe('overrideExtraFormData', () => {
  it('should assign allowed non-existent value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
        },
        {
          time_range: '100 years ago',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_range: '100 years ago',
    });
  });

  it('should override allowed preexisting value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          time_range: '100 years ago',
        },
        {
          time_range: '50 years ago',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_range: '50 years ago',
    });
  });

  it('should not override non-allowed value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          time_range: '100 years ago',
        },
        {
          // @ts-expect-error
          viz_type: 'other custom viz',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_range: '100 years ago',
    });
  });

  it('should override pre-existing extra value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          time_range: '100 years ago',
          extras: {
            time_grain_sqla: 'PT1H',
          },
        },
        { time_grain_sqla: 'PT2H' },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_range: '100 years ago',
      extras: {
        time_grain_sqla: 'PT2H',
      },
    });
  });

  it('should add extra override value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          time_range: '100 years ago',
        },
        {
          time_grain_sqla: 'PT1H',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_range: '100 years ago',
      extras: {
        time_grain_sqla: 'PT1H',
      },
    });
  });
});
