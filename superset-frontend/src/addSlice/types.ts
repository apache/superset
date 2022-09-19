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
import { ReactNode } from 'react';

export type Column = {
  column_name: string;
};

export type DatasetValue = {
  schema: string;
  table_name: string;
  database_name: string;
  column_names: string[];
};

export type Dataset = {
  id: number;
  schema: string;
  table_name: string;
  description: string;
  datasource_type: string;
  database: {
    database_name: string;
    sqlalchemy_uri: string;
  };
  columns: Column[];
};

export type StateDataset = {
  label: string;
  value: string;
  schema: string;
  table_name: string;
  database_name: string;
  column_names: string[];
  sqlalchemy_uri: string;
};

export type AdditionalStateDataset = {
  label?: string;
  value?: string;
  schema?: string;
  join_type?: string;
  table_name?: string;
  database_name?: string;
  sqlalchemy_uri?: string;
  column_names?: string[];
};

export type List = {
  key: number;
  label: string;
  value: string;
  schema: string;
  table_name: string;
  database_name: string;
  sqlalchemy_uri: string;
  customLabel: ReactNode;
  column_names: string[];
};

export type DatasourceJoin = {
  first_column: string;
  second_column: string;
};

export type DatasourceJoins = DatasourceJoin[];
