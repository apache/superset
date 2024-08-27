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

export enum FilterType {
  Regular = 'Regular',
  Base = 'Base',
}

export type RLSObject = {
  id?: number;
  name: string;
  filter_type: FilterType;
  tables?: TableObject[];
  roles?: RoleObject[];
  group_key?: string;
  clause?: string;
  description?: string;
};

export type TableObject = {
  key: any;
  id?: number;
  label?: string;
  value?: number | string;
  schema?: string;
  table_name?: string;
};

export type RoleObject = {
  key: any;
  id?: number;
  label?: string;
  value?: number | string;
  name?: string;
};
