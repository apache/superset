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
  AnnotationLayer,
  AnnotationOpacity,
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  AxisType,
  DataRecord,
  FormulaAnnotationLayer,
  TimeseriesDataRecord,
} from '@superset-ui/core';
import {
  evalFormula,
  extractAnnotationLabels,
  formatAnnotationLabel,
  parseAnnotationOpacity,
} from '../../src/utils/annotation';

describe('formatAnnotationLabel', () => {
  it('should handle default cases properly', () => {
    expect(formatAnnotationLabel('name')).toEqual('name');
    expect(formatAnnotationLabel('name', 'title')).toEqual('name - title');
    expect(formatAnnotationLabel('name', 'title', ['description'])).toEqual(
      'name - title\n\ndescription',
    );
  });

  it('should handle missing cases properly', () => {
    expect(formatAnnotationLabel()).toEqual('');
    expect(formatAnnotationLabel(undefined, 'title')).toEqual('title');
    expect(formatAnnotationLabel('name', undefined, ['description'])).toEqual(
      'name\n\ndescription',
    );
    expect(
      formatAnnotationLabel(undefined, undefined, ['description']),
    ).toEqual('description');
  });

  it('should handle multiple descriptions properly', () => {
    expect(
      formatAnnotationLabel('name', 'title', [
        'description 1',
        'description 2',
      ]),
    ).toEqual('name - title\n\ndescription 1\ndescription 2');
    expect(
      formatAnnotationLabel(undefined, undefined, [
        'description 1',
        'description 2',
      ]),
    ).toEqual('description 1\ndescription 2');
  });
});

describe('extractForecastSeriesContext', () => {
  it('should extract the correct series name and type', () => {
    expect(parseAnnotationOpacity(AnnotationOpacity.Low)).toEqual(0.2);
    expect(parseAnnotationOpacity(AnnotationOpacity.Medium)).toEqual(0.5);
    expect(parseAnnotationOpacity(AnnotationOpacity.High)).toEqual(0.8);
    expect(parseAnnotationOpacity(AnnotationOpacity.Undefined)).toEqual(1);
    expect(parseAnnotationOpacity(undefined)).toEqual(1);
  });
});

describe('extractAnnotationLabels', () => {
  it('should extract all annotations that can be added to the legend', () => {
    const layers: AnnotationLayer[] = [
      {
        annotationType: AnnotationType.Formula,
        name: 'My Formula',
        show: true,
        style: AnnotationStyle.Solid,
        value: 'sin(x)',
        showLabel: true,
      },
      {
        annotationType: AnnotationType.Formula,
        name: 'My Hidden Formula',
        show: false,
        style: AnnotationStyle.Solid,
        value: 'sin(2x)',
        showLabel: true,
      },
      {
        annotationType: AnnotationType.Interval,
        name: 'My Interval',
        sourceType: AnnotationSourceType.Table,
        show: true,
        style: AnnotationStyle.Solid,
        value: 1,
        showLabel: true,
      },
      {
        annotationType: AnnotationType.Timeseries,
        name: 'My Line',
        show: true,
        style: AnnotationStyle.Dashed,
        sourceType: AnnotationSourceType.Line,
        value: 1,
        showLabel: true,
      },
      {
        annotationType: AnnotationType.Timeseries,
        name: 'My Hidden Line',
        show: false,
        style: AnnotationStyle.Dashed,
        sourceType: AnnotationSourceType.Line,
        value: 1,
        showLabel: true,
      },
    ];
    const results: AnnotationData = {
      'My Interval': {
        records: [{ col: 1 }],
      },
      'My Line': [
        { key: 'Line 1', values: [] },
        { key: 'Line 2', values: [] },
      ],
    };

    expect(extractAnnotationLabels(layers, results)).toEqual([
      'My Formula',
      'Line 1',
      'Line 2',
    ]);
  });
});

describe('evalFormula', () => {
  const layer: FormulaAnnotationLayer = {
    annotationType: AnnotationType.Formula,
    name: 'My Formula',
    show: true,
    style: AnnotationStyle.Solid,
    value: 'x+1',
    showLabel: true,
  };
  it('Should evaluate a regular formula', () => {
    const data: TimeseriesDataRecord[] = [
      { __timestamp: 0 },
      { __timestamp: 10 },
    ];

    expect(evalFormula(layer, data, '__timestamp', AxisType.time)).toEqual([
      [0, 1],
      [10, 11],
    ]);
  });

  it('Should evaluate a formula containing redundant characters', () => {
    const data: TimeseriesDataRecord[] = [
      { __timestamp: 0 },
      { __timestamp: 10 },
    ];

    expect(
      evalFormula(
        { ...layer, value: 'y  = x* 2   -1' },
        data,
        '__timestamp',
        AxisType.time,
      ),
    ).toEqual([
      [0, -1],
      [10, 19],
    ]);
  });

  it('Should evaluate a formula if axis type is category', () => {
    const data: DataRecord[] = [{ gender: 'boy' }, { gender: 'girl' }];

    expect(
      evalFormula(
        { ...layer, value: 'y = 1000' },
        data,
        'gender',
        AxisType.category,
      ),
    ).toEqual([
      ['boy', 1000],
      ['girl', 1000],
    ]);
  });
});
