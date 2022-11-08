/* eslint-disable no-underscore-dangle */
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
import { isEmpty } from 'lodash';

import {
  Annotation,
  AnnotationData,
  AnnotationLayer,
  AnnotationOpacity,
  AnnotationType,
  DataRecord,
  evalExpression,
  FormulaAnnotationLayer,
  isRecordAnnotationResult,
  isTableAnnotationLayer,
  isTimeseriesAnnotationResult,
  AxisType,
} from '@superset-ui/core';
import { EchartsTimeseriesChartProps } from '../types';
import { EchartsMixedTimeseriesProps } from '../MixedTimeseries/types';

export function evalFormula(
  formula: FormulaAnnotationLayer,
  data: DataRecord[],
  xAxis: string,
  xAxisType: AxisType,
): [any, number][] {
  const { value: expression } = formula;

  return data.map(row => {
    let value = row[xAxis];
    if (xAxisType === 'time') {
      value = new Date(value as string).getTime();
    }
    return [value, evalExpression(expression, (value || 0) as number)];
  });
}

export function parseAnnotationOpacity(opacity?: AnnotationOpacity): number {
  switch (opacity) {
    case AnnotationOpacity.Low:
      return 0.2;
    case AnnotationOpacity.Medium:
      return 0.5;
    case AnnotationOpacity.High:
      return 0.8;
    default:
      return 1;
  }
}

const NATIVE_COLUMN_NAMES = {
  descriptionColumns: ['long_descr'],
  intervalEndColumn: 'end_dttm',
  timeColumn: 'start_dttm',
  titleColumn: 'short_descr',
};

export function extractRecordAnnotations(
  annotationLayer: AnnotationLayer,
  annotationData: AnnotationData,
): Annotation[] {
  const { name } = annotationLayer;
  const result = annotationData[name];
  if (isRecordAnnotationResult(result)) {
    const { records } = result;
    const {
      descriptionColumns = [],
      intervalEndColumn = '',
      timeColumn = '',
      titleColumn = '',
    } = isTableAnnotationLayer(annotationLayer)
      ? annotationLayer
      : NATIVE_COLUMN_NAMES;

    return records.map(record => ({
      descriptions: descriptionColumns.map(
        column => (record[column] || '') as string,
      ) as string[],
      intervalEnd: (record[intervalEndColumn] || '') as string,
      time: (record[timeColumn] || '') as string,
      title: (record[titleColumn] || '') as string,
    }));
  }
  throw new Error('Please rerun the query.');
}

export function formatAnnotationLabel(
  name?: string,
  title?: string,
  descriptions: string[] = [],
): string {
  const labels: string[] = [];
  const titleLabels: string[] = [];
  const filteredDescriptions = descriptions.filter(
    description => !!description,
  );
  if (name) titleLabels.push(name);
  if (title) titleLabels.push(title);
  if (titleLabels.length > 0) labels.push(titleLabels.join(' - '));
  if (filteredDescriptions.length > 0)
    labels.push(filteredDescriptions.join('\n'));
  return labels.join('\n\n');
}

export function extractAnnotationLabels(
  layers: AnnotationLayer[],
  data: AnnotationData,
): string[] {
  const formulaAnnotationLabels = layers
    .filter(anno => anno.annotationType === AnnotationType.Formula && anno.show)
    .map(anno => anno.name);
  const timeseriesAnnotationLabels = layers
    .filter(
      anno => anno.annotationType === AnnotationType.Timeseries && anno.show,
    )
    .flatMap(anno => {
      const result = data[anno.name];
      return isTimeseriesAnnotationResult(result)
        ? result.map(annoSeries => annoSeries.key)
        : [];
    });

  return formulaAnnotationLabels.concat(timeseriesAnnotationLabels);
}

export function getAnnotationData(
  chartProps: EchartsTimeseriesChartProps | EchartsMixedTimeseriesProps,
): AnnotationData {
  const data = chartProps?.queriesData[0]?.annotation_data as AnnotationData;
  if (!isEmpty(data)) {
    return data;
  }
  return {};
}
