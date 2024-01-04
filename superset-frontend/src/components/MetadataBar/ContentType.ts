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
  DASHBOARDS = 'dashboards',
  DESCRIPTION = 'description',
  LAST_MODIFIED = 'lastModified',
  OWNER = 'owner',
  ROWS = 'rows',
  SQL = 'sql',
  TABLE = 'table',
  TAGS = 'tags',
}

export type Dashboards = {
  type: MetadataType.DASHBOARDS;
  title: string;
  description?: string;
  onClick?: (type: string) => void;
};

export type Description = {
  type: MetadataType.DESCRIPTION;
  value: string;
  onClick?: (type: string) => void;
};

export type LastModified = {
  type: MetadataType.LAST_MODIFIED;
  value: string;
  modifiedBy: string;
  onClick?: (type: string) => void;
};

export type Owner = {
  type: MetadataType.OWNER;
  createdBy: string;
  owners?: string[];
  createdOn: string;
  onClick?: (type: string) => void;
};

export type Rows = {
  type: MetadataType.ROWS;
  title: string;
  onClick?: (type: string) => void;
};

export type Sql = {
  type: MetadataType.SQL;
  title: string;
  onClick?: (type: string) => void;
};

export type Table = {
  type: MetadataType.TABLE;
  title: string;
  onClick?: (type: string) => void;
};

export type Tags = {
  type: MetadataType.TAGS;
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
