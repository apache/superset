/*
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
  AnnotationSourceType,
  AnnotationStyle,
  AnnotationType,
  EventAnnotationLayer,
  FormulaAnnotationLayer,
  IntervalAnnotationLayer,
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isRecordAnnotationResult,
  isTableAnnotationLayer,
  isTimeseriesAnnotationLayer,
  isTimeseriesAnnotationResult,
  RecordAnnotationResult,
  TableAnnotationLayer,
  TimeseriesAnnotationLayer,
  TimeseriesAnnotationResult,
} from '@superset-ui/core/src/query/types/AnnotationLayer';

describe('AnnotationLayer type guards', () => {
  const formulaAnnotationLayer: FormulaAnnotationLayer = {
    annotationType: AnnotationType.Formula,
    name: 'My Formula',
    value: 'sin(2*x)',
    style: AnnotationStyle.Solid,
    show: true,
    showLabel: false,
  };
  const eventAnnotationLayer: EventAnnotationLayer = {
    annotationType: AnnotationType.Event,
    name: 'My Event',
    value: 1,
    style: AnnotationStyle.Solid,
    show: true,
    showLabel: false,
    sourceType: AnnotationSourceType.Native,
  };
  const intervalAnnotationLayer: IntervalAnnotationLayer = {
    annotationType: AnnotationType.Interval,
    sourceType: AnnotationSourceType.Table,
    name: 'My Event',
    value: 1,
    style: AnnotationStyle.Solid,
    show: true,
    showLabel: false,
  };
  const timeseriesAnnotationLayer: TimeseriesAnnotationLayer = {
    annotationType: AnnotationType.Timeseries,
    sourceType: AnnotationSourceType.Line,
    name: 'My Event',
    value: 1,
    style: AnnotationStyle.Solid,
    show: true,
    showLabel: false,
  };
  const tableAnnotationLayer: TableAnnotationLayer = {
    annotationType: AnnotationType.Interval,
    sourceType: AnnotationSourceType.Table,
    name: 'My Event',
    value: 1,
    style: AnnotationStyle.Solid,
    show: true,
    showLabel: false,
  };
  const timeseriesAnnotationResult: TimeseriesAnnotationResult = [
    {
      key: 'My Key',
      values: [
        { x: -1000, y: 0 },
        { x: 0, y: 1000 },
        { x: 1000, y: 2000 },
      ],
    },
  ];
  const recordAnnotationResult: RecordAnnotationResult = {
    columns: ['col1', 'col2'],
    records: [
      { a: 1, b: 2 },
      { a: 2, b: 3 },
    ],
  };

  describe('isFormulaAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(isFormulaAnnotationLayer(formulaAnnotationLayer)).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(isFormulaAnnotationLayer(eventAnnotationLayer)).toEqual(false);
      expect(isFormulaAnnotationLayer(intervalAnnotationLayer)).toEqual(false);
      expect(isFormulaAnnotationLayer(timeseriesAnnotationLayer)).toEqual(
        false,
      );
    });
  });

  describe('isEventAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(isEventAnnotationLayer(eventAnnotationLayer)).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(isEventAnnotationLayer(formulaAnnotationLayer)).toEqual(false);
      expect(isEventAnnotationLayer(intervalAnnotationLayer)).toEqual(false);
      expect(isEventAnnotationLayer(timeseriesAnnotationLayer)).toEqual(false);
    });
  });

  describe('isIntervalAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(isIntervalAnnotationLayer(intervalAnnotationLayer)).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(isIntervalAnnotationLayer(formulaAnnotationLayer)).toEqual(false);
      expect(isIntervalAnnotationLayer(eventAnnotationLayer)).toEqual(false);
      expect(isIntervalAnnotationLayer(timeseriesAnnotationLayer)).toEqual(
        false,
      );
    });
  });

  describe('isTimeseriesAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(isTimeseriesAnnotationLayer(timeseriesAnnotationLayer)).toEqual(
        true,
      );
    });
    it('should return false otherwise', () => {
      expect(isTimeseriesAnnotationLayer(formulaAnnotationLayer)).toEqual(
        false,
      );
      expect(isTimeseriesAnnotationLayer(eventAnnotationLayer)).toEqual(false);
      expect(isTimeseriesAnnotationLayer(intervalAnnotationLayer)).toEqual(
        false,
      );
    });
  });

  describe('isTableAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(isTableAnnotationLayer(tableAnnotationLayer)).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(isTableAnnotationLayer(formulaAnnotationLayer)).toEqual(false);
    });
  });

  describe('isTimeseriesAnnotationResult', () => {
    it('should return true when it is the correct type', () => {
      expect(isTimeseriesAnnotationResult(timeseriesAnnotationResult)).toEqual(
        true,
      );
    });
    it('should return false otherwise', () => {
      expect(isTimeseriesAnnotationResult(recordAnnotationResult)).toEqual(
        false,
      );
    });
  });

  describe('isRecordAnnotationResult', () => {
    it('should return true when it is the correct type', () => {
      expect(isRecordAnnotationResult(recordAnnotationResult)).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(isRecordAnnotationResult(timeseriesAnnotationResult)).toEqual(
        false,
      );
    });
  });
});
