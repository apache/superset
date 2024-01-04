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
  GenericDataType,
  testQueryResponse,
  testQueryResults,
} from '@superset-ui/core';
import {
  Dataset,
  getTemporalColumns,
  isTemporalColumn,
  TestDataset,
} from '../../src';

test('get temporal columns from a Dataset', () => {
  expect(getTemporalColumns(TestDataset)).toEqual({
    temporalColumns: [
      {
        advanced_data_type: undefined,
        certification_details: null,
        certified_by: null,
        column_name: 'ds',
        description: null,
        expression: '',
        filterable: true,
        groupby: true,
        id: 329,
        is_certified: false,
        is_dttm: true,
        python_date_format: null,
        type: 'TIMESTAMP WITHOUT TIME ZONE',
        type_generic: 2,
        verbose_name: null,
        warning_markdown: null,
      },
    ],
    defaultTemporalColumn: 'ds',
  });
});

test('get temporal columns from a QueryResponse', () => {
  expect(getTemporalColumns(testQueryResponse)).toEqual({
    temporalColumns: [
      {
        column_name: 'Column 2',
        is_dttm: true,
        type: 'TIMESTAMP',
        type_generic: GenericDataType.TEMPORAL,
      },
    ],
    defaultTemporalColumn: 'Column 2',
  });
});

test('get temporal columns from null', () => {
  expect(getTemporalColumns(null)).toEqual({
    temporalColumns: [],
    defaultTemporalColumn: undefined,
  });
});

test('should accept empty Dataset or queryResponse', () => {
  expect(
    getTemporalColumns({
      ...TestDataset,
      ...{
        columns: [],
        main_dttm_col: undefined,
      },
    } as any as Dataset),
  ).toEqual({
    temporalColumns: [],
    defaultTemporalColumn: undefined,
  });

  expect(
    getTemporalColumns({
      ...testQueryResponse,
      ...{
        columns: [],
        results: { ...testQueryResults.results, ...{ columns: [] } },
      },
    }),
  ).toEqual({
    temporalColumns: [],
    defaultTemporalColumn: undefined,
  });
});

test('should determine temporal columns in a Dataset', () => {
  expect(isTemporalColumn('ds', TestDataset)).toBeTruthy();
  expect(isTemporalColumn('num', TestDataset)).toBeFalsy();
});
