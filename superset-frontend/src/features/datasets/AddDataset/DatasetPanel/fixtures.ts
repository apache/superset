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
import { DatasetObject } from 'src/features/datasets/AddDataset/types';
import { ITableColumn } from './types';

export const exampleColumns: ITableColumn[] = [
  {
    name: 'name',
    type: 'STRING',
  },
  {
    name: 'height_in_inches',
    type: 'NUMBER',
  },
  {
    name: 'birth_date',
    type: 'DATE',
  },
];

export const exampleDataset: DatasetObject[] = [
  {
    db: {
      id: 1,
      database_name: 'test_database',
      owners: [1],
      backend: 'test_backend',
    },
    schema: 'test_schema',
    dataset_name: 'example_dataset',
    table_name: 'example_table',
  },
];
