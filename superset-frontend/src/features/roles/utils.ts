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

export const updateRoleName = async (roleId: number, name: string) =>
  SupersetClient.put({
    endpoint: `/api/v1/security/roles/${roleId}`,
    jsonPayload: { name },
  });
