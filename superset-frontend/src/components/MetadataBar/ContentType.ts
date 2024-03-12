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

export enum MetadataType {
  Dashboards = 'dashboards',
  Description = 'description',
  LastModified = 'lastModified',
  Owner = 'owner',
  Rows = 'rows',
  Sql = 'sql',
  Table = 'table',
  Tags = 'tags',
}

export type Dashboards = {
  type: MetadataType.Dashboards;
  title: string;
  description?: string;
  onClick?: (type: string) => void;
};

export type Description = {
  type: MetadataType.Description;
  value: string;
  onClick?: (type: string) => void;
};

export type LastModified = {
  type: MetadataType.LastModified;
  value: string;
  modifiedBy: string;
  onClick?: (type: string) => void;
};

export type Owner = {
  type: MetadataType.Owner;
  createdBy: string;
  owners?: string[];
  createdOn: string;
  onClick?: (type: string) => void;
};

export type Rows = {
  type: MetadataType.Rows;
  title: string;
  onClick?: (type: string) => void;
};

export type Sql = {
  type: MetadataType.Sql;
  title: string;
  onClick?: (type: string) => void;
};

export type Table = {
  type: MetadataType.Table;
  title: string;
  onClick?: (type: string) => void;
};

export type Tags = {
  type: MetadataType.Tags;
  values: string[];
  onClick?: (type: string) => void;
};

export type ContentType =
  | Dashboards
  | Description
  | LastModified
  | Owner
  | Rows
  | Sql
  | Table
  | Tags;
