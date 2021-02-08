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
import {
  appendExtraFormData,
  overrideExtraFormData,
} from '@superset-ui/core/src/query/processExtraFormData';

describe('appendExtraFormData', () => {
  it('should add allowed values to non-existent value', () => {
    expect(
      appendExtraFormData(
        {
          datasource: 'table_1',
          granularity: 'something',
          viz_type: 'custom',
        },
        {
          filters: [{ col: 'my_col', op: '==', val: 'my value' }],
        },
      ),
    ).toEqual({
      datasource: 'table_1',
      filters: [{ col: 'my_col', op: '==', val: 'my value' }],
      granularity: 'something',
      viz_type: 'custom',
    });
  });

  it('should add allowed values to preexisting value(s)', () => {
    expect(
      appendExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          filters: [{ col: 'my_col', op: '==', val: 'my value' }],
        },
        {
          filters: [{ col: 'my_other_col', op: '!=', val: 'my other value' }],
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      filters: [
        { col: 'my_col', op: '==', val: 'my value' },
        { col: 'my_other_col', op: '!=', val: 'my other value' },
      ],
    });
  });

  it('should add new freeform where', () => {
    expect(
      appendExtraFormData(
        {
          datasource: 'table_1',
          granularity: 'something',
          viz_type: 'custom',
        },
        {
          extras: {
            where: '1 = 0',
          },
        },
      ),
    ).toEqual({
      datasource: 'table_1',
      granularity: 'something',
      viz_type: 'custom',
      extras: {
        where: '(1 = 0)',
      },
    });
  });

  it('should add new freeform where to existing where clause', () => {
    expect(
      appendExtraFormData(
        {
          datasource: 'table_1',
          granularity: 'something',
          viz_type: 'custom',
          extras: {
            where: 'abc = 1',
          },
        },
        {
          extras: {
            where: '1 = 0',
          },
        },
      ),
    ).toEqual({
      datasource: 'table_1',
      granularity: 'something',
      viz_type: 'custom',
      extras: {
        where: '(abc = 1) AND (1 = 0)',
      },
    });
  });
  it('should not change existing where if append where is missing', () => {
    expect(
      appendExtraFormData(
        {
          datasource: 'table_1',
          granularity: 'something',
          viz_type: 'custom',
          extras: {
            where: 'abc = 1',
          },
        },
        {
          extras: {},
        },
      ),
    ).toEqual({
      datasource: 'table_1',
      granularity: 'something',
      viz_type: 'custom',
      extras: {
        where: 'abc = 1',
      },
    });
  });
});

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
          time_grain_sqla: 'PT1H',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_grain_sqla: 'PT1H',
    });
  });

  it('should override allowed preexisting value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          time_grain_sqla: 'PT1H',
        },
        {
          time_grain_sqla: 'PT2H',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_grain_sqla: 'PT2H',
    });
  });

  it('should not override non-allowed value', () => {
    expect(
      overrideExtraFormData(
        {
          granularity: 'something',
          viz_type: 'custom',
          datasource: 'table_1',
          time_grain_sqla: 'PT1H',
        },
        {
          viz_type: 'other custom viz',
        },
      ),
    ).toEqual({
      granularity: 'something',
      viz_type: 'custom',
      datasource: 'table_1',
      time_grain_sqla: 'PT1H',
    });
  });
});
