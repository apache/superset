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
import transformProps from '../BigNumber/transformProps';

const formData = {
  metric: 'value',
  colorPicker: {
    r: 0,
    g: 122,
    b: 135,
    a: 1,
  },
  compareLag: 1,
  timeGrainSqla: 'P0.25Y',
  compareSuffix: 'over last quarter',
  vizType: 'big_number',
  yAxisFormat: '.3s',
};

function generateProps(data: object[], extraFormData = {}, extraQueryData = {}) {
  return {
    width: 200,
    height: 500,
    annotationData: {},
    datasource: {
      columnFormats: {},
      verboseMap: {},
    },
    rawDatasource: {},
    rawFormData: {},
    hooks: {},
    initialValues: {},
    formData: {
      ...formData,
      ...extraFormData,
    },
    queryData: {
      data,
      ...extraQueryData,
    },
  };
}

describe('BigNumber', () => {
  describe('transformProps()', () => {
    const props = generateProps(
      [
        {
          __timestamp: 0,
          value: 1,
        },
        {
          __timestamp: 100,
          value: null,
        },
      ],
      { showTrendLine: true },
    );
    const transformed = transformProps(props);

    it('timeRangeUseFallback', () => {
      // the first item is the last item sorted by __timestamp
      const lastDatum = transformed.trendLineData?.pop();
      expect(lastDatum?.x).toStrictEqual(100);
      expect(lastDatum?.y).toBeNull();
      expect(transformed.bigNumber).toStrictEqual(1);
      expect(transformed.bigNumberFallback).not.toBeNull();
    });

    it('formatTime by ganularity', () => {
      expect(transformed.formatTime(new Date('2020-01-01'))).toStrictEqual('2020 Q1');
    });
  });
});
