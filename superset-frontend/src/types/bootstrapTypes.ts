import { JsonObject, Locale } from '@superset-ui/core';

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
export type User = {
  createdOn: string;
  email: string;
  firstName: string;
  isActive: boolean;
  isAnonymous: boolean;
  lastName: string;
  userId: number;
  username: string;
};

export interface UserWithPermissionsAndRoles extends User {
  permissions: {
    database_access?: string[];
    datasource_access?: string[];
  };
  roles: Record<string, [string, string][]>;
}

export type Dashboard = {
  dttm: number;
  id: number;
  url: string;
  title: string;
  creator?: string;
  creator_url?: string;
};

export interface CommonBootstrapData {
  flash_messages: string[][];
  conf: JsonObject;
  locale: Locale;
  feature_flags: Record<string, boolean>;
}
