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
import { AnnotationLayer, AnnotationResult } from '@superset-ui/core';
import {
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
    expect(formatAnnotationLabel(undefined, undefined, ['description'])).toEqual('description');
  });

  it('should handle multiple descriptions properly', () => {
    expect(formatAnnotationLabel('name', 'title', ['description 1', 'description 2'])).toEqual(
      'name - title\n\ndescription 1\ndescription 2',
    );
    expect(formatAnnotationLabel(undefined, undefined, ['description 1', 'description 2'])).toEqual(
      'description 1\ndescription 2',
    );
  });
});

describe('extractForecastSeriesContext', () => {
  it('should extract the correct series name and type', () => {
    expect(parseAnnotationOpacity('opacityLow')).toEqual(0.2);
    expect(parseAnnotationOpacity('opacityMedium')).toEqual(0.5);
    expect(parseAnnotationOpacity('opacityHigh')).toEqual(0.8);
    expect(parseAnnotationOpacity('')).toEqual(1);
    expect(parseAnnotationOpacity(undefined)).toEqual(1);
  });
});

describe('extractAnnotationLabels', () => {
  it('should extract all annotations that can be added to the legend', () => {
    const layers: AnnotationLayer[] = [
      {
        annotationType: 'FORMULA',
        name: 'My Formula',
        show: true,
        style: 'solid',
        value: 'sin(x)',
      },
      {
        annotationType: 'FORMULA',
        name: 'My Hidden Formula',
        show: false,
        style: 'solid',
        value: 'sin(2x)',
      },
      {
        annotationType: 'INTERVAL',
        name: 'My Interval',
        sourceType: 'table',
        show: true,
        style: 'solid',
        value: 1,
      },
      {
        annotationType: 'TIME_SERIES',
        name: 'My Line',
        show: true,
        style: 'dashed',
        sourceType: 'line',
        value: 1,
      },
      {
        annotationType: 'TIME_SERIES',
        name: 'My Hidden Line',
        show: false,
        style: 'dashed',
        sourceType: 'line',
        value: 1,
      },
    ];
    const results: AnnotationResult = {
      'My Interval': {
        columns: ['col'],
        records: [{ col: 1 }],
      },
      'My Line': [
        { key: 'Line 1', values: [] },
        { key: 'Line 2', values: [] },
      ],
    };

    expect(extractAnnotationLabels(layers, results)).toEqual(['My Formula', 'Line 1', 'Line 2']);
  });
});
