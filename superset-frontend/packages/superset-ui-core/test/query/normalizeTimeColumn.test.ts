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
  normalizeTimeColumn,
  QueryObject,
  SqlaFormData,
} from '@superset-ui/core';

describe('GENERIC_CHART_AXES is disabled', () => {
  let windowSpy: any;

  beforeAll(() => {
    // @ts-ignore
    windowSpy = jest.spyOn(window, 'window', 'get').mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: false,
      },
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

  it('should return original QueryObject if disabled GENERIC_CHART_AXES', () => {
    const formData: SqlaFormData = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      time_grain_sqla: 'P1Y',
      time_range: '1 year ago : 2013',
      columns: ['col1'],
      metrics: ['count(*)'],
    };
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: ['col1'],
      metrics: ['count(*)'],
      is_timeseries: true,
    };
    expect(normalizeTimeColumn(formData, query)).toEqual(query);
  });

  it('should return converted QueryObject even though disabled GENERIC_CHART_AXES (x_axis in formData)', () => {
    const formData: SqlaFormData = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      time_grain_sqla: 'P1Y',
      time_range: '1 year ago : 2013',
      columns: ['col1'],
      metrics: ['count(*)'],
      x_axis: 'time_column',
    };
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: ['time_column', 'col1'],
      metrics: ['count(*)'],
      is_timeseries: true,
    };
    expect(normalizeTimeColumn(formData, query)).toEqual({
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: [
        {
          timeGrain: 'P1Y',
          columnType: 'BASE_AXIS',
          sqlExpression: 'time_column',
          label: 'time_column',
          expressionType: 'SQL',
        },
        'col1',
      ],
      metrics: ['count(*)'],
    });
  });
});

describe('GENERIC_CHART_AXES is enabled', () => {
  let windowSpy: any;

  beforeAll(() => {
    // @ts-ignore
    windowSpy = jest.spyOn(window, 'window', 'get').mockImplementation(() => ({
      featureFlags: {
        GENERIC_CHART_AXES: true,
      },
    }));
  });

  afterAll(() => {
    windowSpy.mockRestore();
  });

  it('should return original QueryObject if x_axis is empty', () => {
    const formData: SqlaFormData = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      time_grain_sqla: 'P1Y',
      time_range: '1 year ago : 2013',
      columns: ['col1'],
      metrics: ['count(*)'],
    };
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: ['col1'],
      metrics: ['count(*)'],
      is_timeseries: true,
    };
    expect(normalizeTimeColumn(formData, query)).toEqual(query);
  });

  it('should support different columns for x-axis and granularity', () => {
    const formData: SqlaFormData = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      time_grain_sqla: 'P1Y',
      time_range: '1 year ago : 2013',
      x_axis: 'time_column_in_x_axis',
      columns: ['col1'],
      metrics: ['count(*)'],
    };
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
        where: '',
        having: '',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: ['time_column_in_x_axis', 'col1'],
      metrics: ['count(*)'],
      is_timeseries: true,
    };
    expect(normalizeTimeColumn(formData, query)).toEqual({
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: { where: '', having: '', time_grain_sqla: 'P1Y' },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: [
        {
          timeGrain: 'P1Y',
          columnType: 'BASE_AXIS',
          sqlExpression: 'time_column_in_x_axis',
          label: 'time_column_in_x_axis',
          expressionType: 'SQL',
        },
        'col1',
      ],
      metrics: ['count(*)'],
    });
  });

  it('should support custom SQL in x-axis', () => {
    const formData: SqlaFormData = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      time_grain_sqla: 'P1Y',
      time_range: '1 year ago : 2013',
      x_axis: {
        expressionType: 'SQL',
        label: 'Order Data + 1 year',
        sqlExpression: '"Order Date" + interval \'1 year\'',
      },
      columns: ['col1'],
      metrics: ['count(*)'],
    };
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
        where: '',
        having: '',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: [
        {
          expressionType: 'SQL',
          label: 'Order Data + 1 year',
          sqlExpression: '"Order Date" + interval \'1 year\'',
        },
        'col1',
      ],
      metrics: ['count(*)'],
      is_timeseries: true,
    };
    expect(normalizeTimeColumn(formData, query)).toEqual({
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: { where: '', having: '', time_grain_sqla: 'P1Y' },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      columns: [
        {
          timeGrain: 'P1Y',
          columnType: 'BASE_AXIS',
          expressionType: 'SQL',
          label: 'Order Data + 1 year',
          sqlExpression: `"Order Date" + interval '1 year'`,
        },
        'col1',
      ],
      metrics: ['count(*)'],
    });
  });

  it('fallback and invalid columns value', () => {
    const formData: SqlaFormData = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      time_grain_sqla: 'P1Y',
      time_range: '1 year ago : 2013',
      x_axis: {
        expressionType: 'SQL',
        label: 'Order Data + 1 year',
        sqlExpression: '"Order Date" + interval \'1 year\'',
      },
      columns: ['col1'],
      metrics: ['count(*)'],
    };
    const query: QueryObject = {
      datasource: '5__table',
      viz_type: 'table',
      granularity: 'time_column',
      extras: {
        time_grain_sqla: 'P1Y',
        where: '',
        having: '',
      },
      time_range: '1 year ago : 2013',
      orderby: [['count(*)', true]],
      metrics: ['count(*)'],
      is_timeseries: true,
    };
    expect(normalizeTimeColumn(formData, query)).toEqual(query);
  });
});
