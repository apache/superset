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

export type EntityType = 'chart' | 'dashboard';

export interface Change {
  kind: string;
  path: string[];
  from_value: unknown;
  to_value: unknown;
}

export interface ChangedBy {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
}

export interface Version {
  version_uuid: string;
  version_number: number;
  transaction_id: number;
  operation_type: string;
  issued_at: string;
  changed_by: ChangedBy | null;
  changes: Change[];
}

export interface VersionSnapshot {
  version_uuid: string;
  version_number: number;
  transaction_id: number;
  operation_type: string;
  issued_at: string;
  changed_by: ChangedBy | null;
  // Scalar fields are merged at the root by the backend; for dashboards
  // a ``slices`` array is included alongside the dashboard-level fields.
  [key: string]: unknown;
}
