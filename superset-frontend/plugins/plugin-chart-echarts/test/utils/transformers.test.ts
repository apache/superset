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
  AnnotationData,
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  AxisType,
  CategoricalColorNamespace,
  EventAnnotationLayer,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  supersetTheme,
  TimeseriesAnnotationLayer,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import { OrientationType } from '@superset-ui/plugin-chart-echarts';
import {
  transformEventAnnotation,
  transformFormulaAnnotation,
  transformIntervalAnnotation,
  transformTimeseriesAnnotation,
} from '../../src/Timeseries/transformers';

const mockData: TimeseriesDataRecord[] = [
  {
    __timestamp: 10,
  },
  {
    __timestamp: 20,
  },
];

const mockFormulaAnnotationLayer: FormulaAnnotationLayer = {
  annotationType: AnnotationType.Formula as const,
  name: 'My Formula',
  show: true,
  style: AnnotationStyle.Solid,
  value: '50',
  showLabel: true,
};

describe('transformFormulaAnnotation', () => {
  it('should transform data correctly', () => {
    expect(
      transformFormulaAnnotation(
        mockFormulaAnnotationLayer,
        mockData,
        '__timestamp',
        AxisType.Value,
        CategoricalColorNamespace.getScale(''),
        undefined,
      ).data,
    ).toEqual([
      [10, 50],
      [20, 50],
    ]);
  });

  it('should swap x and y for horizontal chart', () => {
    expect(
      transformFormulaAnnotation(
        mockFormulaAnnotationLayer,
        mockData,
        '__timestamp',
        AxisType.Value,
        CategoricalColorNamespace.getScale(''),
        undefined,
        OrientationType.Horizontal,
      ).data,
    ).toEqual([
      [50, 10],
      [50, 20],
    ]);
  });
});

const mockIntervalAnnotationLayer: IntervalAnnotationLayer = {
  name: 'Interval annotation layer',
  annotationType: AnnotationType.Interval as const,
  sourceType: AnnotationSourceType.Native as const,
  color: null,
  style: AnnotationStyle.Solid,
  width: 1,
  show: true,
  showLabel: false,
  value: 1,
};

const mockIntervalAnnotationData: AnnotationData = {
  'Interval annotation layer': {
    records: [
      {
        start_dttm: 10,
        end_dttm: 12,
        short_descr: 'Timeseries 1',
        long_descr: '',
        json_metadata: '',
      },
      {
        start_dttm: 13,
        end_dttm: 15,
        short_descr: 'Timeseries 2',
        long_descr: '',
        json_metadata: '',
      },
    ],
  },
};

describe('transformIntervalAnnotation', () => {
  it('should transform data correctly', () => {
    expect(
      transformIntervalAnnotation(
        mockIntervalAnnotationLayer,
        mockData,
        mockIntervalAnnotationData,
        CategoricalColorNamespace.getScale(''),
        supersetTheme,
      )
        .map(annotation => annotation.markArea)
        .map(markArea => markArea.data),
    ).toEqual([
      [
        [
          { name: 'Interval annotation layer - Timeseries 1', xAxis: 10 },
          { xAxis: 12 },
        ],
      ],
      [
        [
          { name: 'Interval annotation layer - Timeseries 2', xAxis: 13 },
          { xAxis: 15 },
        ],
      ],
    ]);
  });

  it('should use yAxis for horizontal chart data', () => {
    expect(
      transformIntervalAnnotation(
        mockIntervalAnnotationLayer,
        mockData,
        mockIntervalAnnotationData,
        CategoricalColorNamespace.getScale(''),
        supersetTheme,
        undefined,
        OrientationType.Horizontal,
      )
        .map(annotation => annotation.markArea)
        .map(markArea => markArea.data),
    ).toEqual([
      [
        [
          { name: 'Interval annotation layer - Timeseries 1', yAxis: 10 },
          { yAxis: 12 },
        ],
      ],
      [
        [
          { name: 'Interval annotation layer - Timeseries 2', yAxis: 13 },
          { yAxis: 15 },
        ],
      ],
    ]);
  });
});

const mockEventAnnotationLayer: EventAnnotationLayer = {
  annotationType: AnnotationType.Event,
  color: null,
  name: 'Event annotation layer',
  show: true,
  showLabel: false,
  sourceType: AnnotationSourceType.Native,
  style: AnnotationStyle.Solid,
  value: 1,
  width: 1,
};

const mockEventAnnotationData: AnnotationData = {
  'Event annotation layer': {
    records: [
      {
        start_dttm: 10,
        end_dttm: 12,
        short_descr: 'Test annotation',
        long_descr: '',
        json_metadata: '',
      },
      {
        start_dttm: 13,
        end_dttm: 15,
        short_descr: 'Test annotation 2',
        long_descr: '',
        json_metadata: '',
      },
    ],
  },
};

describe('transformEventAnnotation', () => {
  it('should transform data correctly', () => {
    expect(
      transformEventAnnotation(
        mockEventAnnotationLayer,
        mockData,
        mockEventAnnotationData,
        CategoricalColorNamespace.getScale(''),
        supersetTheme,
      )
        .map(annotation => annotation.markLine)
        .map(markLine => markLine.data),
    ).toEqual([
      [
        {
          name: 'Event annotation layer - Test annotation',
          xAxis: 10,
        },
      ],
      [{ name: 'Event annotation layer - Test annotation 2', xAxis: 13 }],
    ]);
  });

  it('should use yAxis for horizontal chart data', () => {
    expect(
      transformEventAnnotation(
        mockEventAnnotationLayer,
        mockData,
        mockEventAnnotationData,
        CategoricalColorNamespace.getScale(''),
        supersetTheme,
        undefined,
        OrientationType.Horizontal,
      )
        .map(annotation => annotation.markLine)
        .map(markLine => markLine.data),
    ).toEqual([
      [
        {
          name: 'Event annotation layer - Test annotation',
          yAxis: 10,
        },
      ],
      [{ name: 'Event annotation layer - Test annotation 2', yAxis: 13 }],
    ]);
  });
});

const mockTimeseriesAnnotationLayer: TimeseriesAnnotationLayer = {
  annotationType: AnnotationType.Timeseries,
  color: null,
  hideLine: false,
  name: 'Timeseries annotation layer',
  overrides: {
    time_range: null,
  },
  show: true,
  showLabel: false,
  showMarkers: false,
  sourceType: AnnotationSourceType.Line,
  style: AnnotationStyle.Solid,
  value: 1,
  width: 1,
};

const mockTimeseriesAnnotationData: AnnotationData = {
  'Timeseries annotation layer': [
    {
      key: 'Key 1',
      values: [
        {
          x: 10,
          y: 12,
        },
      ],
    },
    {
      key: 'Key 2',
      values: [
        {
          x: 12,
          y: 15,
        },
        {
          x: 15,
          y: 20,
        },
      ],
    },
  ],
};

describe('transformTimeseriesAnnotation', () => {
  it('should transform data correctly', () => {
    expect(
      transformTimeseriesAnnotation(
        mockTimeseriesAnnotationLayer,
        1,
        mockData,
        mockTimeseriesAnnotationData,
        CategoricalColorNamespace.getScale(''),
      ).map(annotation => annotation.data),
    ).toEqual([
      [[10, 12]],
      [
        [12, 15],
        [15, 20],
      ],
    ]);
  });

  it('should swap x and y for horizontal chart', () => {
    expect(
      transformTimeseriesAnnotation(
        mockTimeseriesAnnotationLayer,
        1,
        mockData,
        mockTimeseriesAnnotationData,
        CategoricalColorNamespace.getScale(''),
        undefined,
        OrientationType.Horizontal,
      ).map(annotation => annotation.data),
    ).toEqual([
      [[12, 10]],
      [
        [15, 12],
        [20, 15],
      ],
    ]);
  });
});
