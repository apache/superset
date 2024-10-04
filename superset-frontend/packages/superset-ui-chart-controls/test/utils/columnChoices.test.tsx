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
  DatasourceType,
  GenericDataType,
  testQueryResponse,
} from '@superset-ui/core';
import { columnChoices } from '../../src';

describe('columnChoices()', () => {
  it('should convert columns to choices when source is a Dataset', () => {
    expect(
      columnChoices({
        id: 1,
        metrics: [],
        type: DatasourceType.Table,
        main_dttm_col: 'test',
        time_grain_sqla: [],
        columns: [
          {
            column_name: 'fiz',
            type: 'INT',
            type_generic: GenericDataType.Numeric,
          },
          {
            column_name: 'about',
            verbose_name: 'right',
            type: 'VARCHAR',
            type_generic: GenericDataType.String,
          },
          {
            column_name: 'foo',
            verbose_name: undefined,
            type: 'TIMESTAMP',
            type_generic: GenericDataType.Temporal,
          },
        ],
        verbose_map: {},
        column_formats: { fiz: 'NUMERIC', about: 'STRING', foo: 'DATE' },
        currency_formats: {},
        datasource_name: 'my_datasource',
        description: 'this is my datasource',
      }),
    ).toEqual([
      ['fiz', 'fiz'],
      ['foo', 'foo'],
      ['about', 'right'],
    ]);
  });

  it('should return empty array when no columns', () => {
    expect(columnChoices(undefined)).toEqual([]);
  });

  it('should convert columns to choices when source is a Query', () => {
    expect(columnChoices(testQueryResponse)).toEqual([
      ['Column 1', 'Column 1'],
      ['Column 2', 'Column 2'],
      ['Column 3', 'Column 3'],
    ]);
  });

  it('should return choices of a specific type', () => {
    expect(columnChoices(testQueryResponse, GenericDataType.Temporal)).toEqual([
      ['Column 2', 'Column 2'],
    ]);
  });
  it('should use name when verbose_name key exists but is not defined', () => {
    expect(
      columnChoices({
        id: 1,
        metrics: [],
        type: DatasourceType.Table,
        main_dttm_col: 'test',
        time_grain_sqla: [],
        columns: [
          {
            column_name: 'foo',
            verbose_name: null,
            type: 'VARCHAR',
            type_generic: GenericDataType.String,
          },
          {
            column_name: 'bar',
            verbose_name: null,
            type: 'VARCHAR',
            type_generic: GenericDataType.String,
          },
        ],
        verbose_map: {},
        column_formats: { fiz: 'NUMERIC', about: 'STRING', foo: 'DATE' },
        currency_formats: {},
        datasource_name: 'my_datasource',
        description: 'this is my datasource',
      }),
    ).toEqual([
      ['bar', 'bar'],
      ['foo', 'foo'],
    ]);
  });
});
