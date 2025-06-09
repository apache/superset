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

import { SupersetClient } from '@superset-ui/core';

export const createRole = async (name: string) =>
  SupersetClient.post({
    endpoint: '/api/v1/security/roles/',
    jsonPayload: { name },
  });

export const updateRolePermissions = async (
  roleId: number,
  permissionIds: number[],
) =>
  SupersetClient.post({
    endpoint: `/api/v1/security/roles/${roleId}/permissions`,
    jsonPayload: { permission_view_menu_ids: permissionIds },
  });

export const updateRoleUsers = async (roleId: number, userIds: number[]) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}/users`,
    jsonPayload: { user_ids: userIds },
  });

export const updateRoleGroups = async (roleId: number, groupIds: number[]) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}/groups`,
    jsonPayload: { group_ids: groupIds },
  });

export const updateRoleName = async (roleId: number, name: string) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}`,
    jsonPayload: { name },
  });
