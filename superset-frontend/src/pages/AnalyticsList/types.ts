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
import type { TagType } from 'src/components';

export type ItemType = 'folder' | 'chart' | 'dashboard';

export interface Owner {
  id: number;
  first_name?: string;
  last_name?: string;
}

/** A contents row (folder or asset) from /api/v1/folders/[<uuid>/]assets. */
export interface ContentItem {
  type: ItemType;
  id: number;
  uuid: string | null;
  name: string;
  url?: string | null;
  viz_type?: string | null;
  datasource_name?: string | null;
  datasource_url?: string | null;
  owners?: Owner[];
  changed_on?: string;
  changed_on_humanized?: string | null;
  changed_by?: Owner | null;
  tags?: TagType[];
  asset_count?: number;
  children_count?: number;
  user_permission?: 'editor' | 'viewer' | null;
  parent_uuid?: string | null;
  inherits_permissions?: boolean;
  folder_path?: Array<{ uuid: string; name: string }>;
}
