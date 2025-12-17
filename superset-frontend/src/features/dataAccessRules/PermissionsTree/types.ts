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

import type { DataNode } from 'antd/es/tree';

export type PermissionState = 'allow' | 'deny' | 'inherit';

export type NodeType = 'database' | 'catalog' | 'schema' | 'table';

export interface PermissionNode extends DataNode {
  key: string;
  title: string;
  nodeType: NodeType;
  databaseId?: number;
  databaseName?: string;
  catalogName?: string;
  schemaName?: string;
  tableName?: string;
  children?: PermissionNode[];
  isLeaf?: boolean;
  hasMore?: boolean;
  totalCount?: number;
}

export interface TreeState {
  expandedKeys: string[];
  loadedKeys: string[];
  treeData: PermissionNode[];
  permissionStates: Record<string, PermissionState>;
  searchValue: string;
}

export interface PermissionsPayload {
  allowed: PermissionEntry[];
  denied: PermissionEntry[];
}

export interface PermissionEntry {
  database: string;
  catalog?: string;
  schema?: string;
  table?: string;
}
