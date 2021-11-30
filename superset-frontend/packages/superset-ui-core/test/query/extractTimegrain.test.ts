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
import extractTimegrain from '@superset-ui/core/src/query/extractTimegrain';
import { QueryFormData } from '@superset-ui/core';

describe('extractTimegrain', () => {
  const baseFormData: QueryFormData = {
    datasource: 'table__1',
    viz_type: 'my_viz',
  };
  it('should extract regular from form data', () => {
    expect(
      extractTimegrain({
        ...baseFormData,
        time_grain_sqla: 'P1D',
      }),
    ).toEqual('P1D');
  });

  it('should extract filter box time grain from form data', () => {
    expect(
      extractTimegrain({
        ...baseFormData,
        time_grain_sqla: 'P1D',
        extra_filters: [
          {
            col: '__time_grain',
            op: '==',
            val: 'P1M',
          },
        ],
      }),
    ).toEqual('P1M');
  });

  it('should extract native filter time grain from form data', () => {
    expect(
      extractTimegrain({
        ...baseFormData,
        time_grain_sqla: 'P1D',
        extra_form_data: {
          time_grain_sqla: 'P1W',
        },
      }),
    ).toEqual('P1W');
  });

  it('should give priority to native filters', () => {
    expect(
      extractTimegrain({
        ...baseFormData,
        time_grain_sqla: 'P1D',
        extra_filters: [
          {
            col: '__time_grain',
            op: '==',
            val: 'P1M',
          },
        ],
        extra_form_data: {
          time_grain_sqla: 'P1W',
        },
      }),
    ).toEqual('P1W');
  });

  it('returns undefined if timegrain not defined', () => {
    expect(extractTimegrain({ ...baseFormData })).toEqual(undefined);
  });
});
