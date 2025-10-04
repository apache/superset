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
export type PermissionView = {
  name: string;
};

export type PermissionResource = {
  id: number;
  permission: PermissionView;
  view_menu: PermissionView;
};

export type FormattedPermission = {
  label: string;
  value: string;
  id: number;
};

export type RolePermissions = {
  id: number;
  permission_name: string;
  view_menu_name: string;
};

export type UserObject = {
  id: number;
  firstName: string;
  lastName: string;
  username: string;
  email: string;
  isActive: boolean;
  roles: Array<RoleInfo>;
};

export type SelectOption = {
  value: number;
  label: string;
};

export type RoleInfo = {
  id: number;
  name: string;
};

export type RoleForm = {
  roleName: string;
  rolePermissions: number[];
  roleUsers: SelectOption[];
  roleGroups: number[];
};

export interface BaseModalProps {
  show: boolean;
  onHide: () => void;
  onSave: () => void;
}
