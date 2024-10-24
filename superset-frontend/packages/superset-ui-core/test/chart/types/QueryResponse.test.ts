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
  isTimeseriesDataRecord,
  isTimeseriesDataRecordList,
} from '@superset-ui/core';

describe('QueryResponse', () => {
  describe('TypeGuards', () => {
    it('correctly determines a TimeseriesDataRecord', () => {
      const timeseriesDataRecord = {
        foo: 'bar',
        __timestamp: 0,
      };
      expect(isTimeseriesDataRecord(timeseriesDataRecord)).toBe(true);
    });

    it('correctly determines if a DataRecord is not a TimeseriesDataRecord', () => {
      const timeseriesDataRecord = {
        foo: 'bar',
      };
      expect(isTimeseriesDataRecord(timeseriesDataRecord)).toBe(false);
    });

    it('correctly determines a TimeseriesDataRecordList', () => {
      const timeseriesDataRecordList = [
        {
          foo: 'bar',
          __timestamp: 0,
        },
        {
          foo: 'baz',
          __timestamp: 1,
        },
      ];
      expect(isTimeseriesDataRecordList(timeseriesDataRecordList)).toBe(true);
    });

    it('correctly determines if a DataRecordList is not a TimeseriesDataRecordList', () => {
      const timeseriesDataRecordList = [
        {
          foo: 'bar',
        },
        {
          foo: 'baz',
        },
      ];
      expect(isTimeseriesDataRecordList(timeseriesDataRecordList)).toBe(false);
    });
  });
});
