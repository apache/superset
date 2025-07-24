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
import { isDerivedSeries } from '@superset-ui/chart-controls';
import { SqlaFormData, ComparisonType, VizType } from '@superset-ui/core';

const formData: SqlaFormData = {
  datasource: 'foo',
  viz_type: VizType.Table,
};
const series = {
  id: 'metric__1 month ago',
  name: 'metric__1 month ago',
  data: [100],
};

test('should be false if comparison type is not actual values', () => {
  expect(isDerivedSeries(series, formData)).toEqual(false);
  Object.keys(ComparisonType)
    .filter(type => type === ComparisonType.Values)
    .forEach(type => {
      const formDataWithComparisonType = {
        ...formData,
        comparison_type: type,
        time_compare: ['1 month ago'],
      };
      expect(isDerivedSeries(series, formDataWithComparisonType)).toEqual(
        false,
      );
    });
});

test('should be true if comparison type is values', () => {
  const formDataWithActualTypes = {
    ...formData,
    comparison_type: ComparisonType.Values,
    time_compare: ['1 month ago', '1 month later'],
  };
  expect(isDerivedSeries(series, formDataWithActualTypes)).toEqual(true);
});

test('should be false if series name does not match time_compare', () => {
  const arbitrary_series = {
    id: 'arbitrary column',
    name: 'arbitrary column',
    data: [100],
  };
  const formDataWithActualTypes = {
    ...formData,
    comparison_type: ComparisonType.Values,
    time_compare: ['1 month ago', '1 month later'],
  };
  expect(isDerivedSeries(arbitrary_series, formDataWithActualTypes)).toEqual(
    false,
  );
});

test('should be false if time compare is not suffix', () => {
  const series = {
    id: '1 month ago__metric',
    name: '1 month ago__metric',
    data: [100],
  };
  const formDataWithActualTypes = {
    ...formData,
    comparison_type: ComparisonType.Values,
    time_compare: ['1 month ago', '1 month later'],
  };
  expect(isDerivedSeries(series, formDataWithActualTypes)).toEqual(false);
});

test('should be false if series name invalid', () => {
  const series = {
    id: 123,
    name: 123,
    data: [100],
  };
  const formDataWithActualTypes = {
    ...formData,
    comparison_type: ComparisonType.Values,
    time_compare: ['1 month ago', '1 month later'],
  };
  expect(isDerivedSeries(series, formDataWithActualTypes)).toEqual(false);
});
