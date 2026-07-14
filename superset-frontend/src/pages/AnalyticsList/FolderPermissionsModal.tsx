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
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SupersetClient } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import {
  AsyncSelect,
  FormLabel,
  Input,
  Select,
  Table,
  TableSize,
  type ColumnsType,
  type SelectOptionsTypePage,
  Tooltip,
  Typography,
  type SelectValue,
} from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';

type Permission = 'editor' | 'viewer' | 'admin';

interface Subject {
  user_id: number;
  permission: Permission;
  email?: string;
  is_admin?: boolean;
}

interface LocalSubject {
  key: string;
  user_id: number;
  permission: Permission;
  label: string;
  isCurrentUser: boolean;
  isAdmin: boolean;
}

interface FolderPermissionsModalProps {
  folderUuid: string;
  folderName: string;
  currentUserId: number;
  isSubfolder?: boolean;
  show: boolean;
  onHide: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const PERMISSION_OPTIONS = [
  { value: 'viewer', label: t('Viewer') },
  { value: 'editor', label: t('Editor') },
];

const StyledFormLabel = styled(FormLabel)`
  ${({ theme }) => css`
    margin-bottom: ${theme.sizeUnit * 0.5}px;
    font-size: ${theme.fontSizeSM}px;
  `}
`;

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

function getUserLabel(u: { email?: string | null }): string {
  return u.email || t('N/A');
}

export default function FolderPermissionsModal({
  folderUuid,
  folderName,
  currentUserId,
  isSubfolder,
  show,
  onHide,
  addDangerToast,
  addSuccessToast,
}: FolderPermissionsModalProps) {
  const theme = useTheme();
  const [serverSubjects, setServerSubjects] = useState<LocalSubject[]>([]);
  const [localSubjects, setLocalSubjects] = useState<LocalSubject[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [adminIds, setAdminIds] = useState<Set<number>>(new Set());

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/folders/${folderUuid}/subjects`,
      });
      const subjects = (json.result as Subject[]) || [];
      const enriched: LocalSubject[] = subjects.map(s => ({
        key: String(s.user_id),
        user_id: s.user_id,
        permission: s.is_admin ? 'admin' : s.permission,
        label: getUserLabel(s),
        isCurrentUser: s.user_id === currentUserId,
        isAdmin: !!s.is_admin,
      }));
      setServerSubjects(enriched);
      setLocalSubjects(enriched);
    } catch {
      addDangerToast(t('Error loading permissions'));
    } finally {
      setLoading(false);
    }
  }, [folderUuid, currentUserId, addDangerToast]);

  useEffect(() => {
    if (show) {
      fetchSubjects();
      setMemberSearch('');
    }
  }, [show, fetchSubjects]);

  const handleAddUser = useCallback(
    (selected: SelectValue) => {
      if (!selected || typeof selected !== 'object') return;
      const item = selected as { value: number; label: string };
      const userId = Number(item.value);
      if (!userId || Number.isNaN(userId)) return;
      const isAdmin = adminIds.has(userId);
      setLocalSubjects(prev => {
        if (prev.some(s => s.user_id === userId)) return prev;
        return [
          ...prev,
          {
            key: String(userId),
            user_id: userId,
            permission: isAdmin
              ? ('admin' as Permission)
              : ('viewer' as Permission),
            label: String(item.label),
            isCurrentUser: userId === currentUserId,
            isAdmin,
          },
        ];
      });
    },
    [currentUserId, adminIds],
  );

  const handleChangePermission = useCallback(
    (userId: number, permission: Permission) => {
      if (userId === currentUserId) return;
      setLocalSubjects(prev =>
        prev.map(s => (s.user_id === userId ? { ...s, permission } : s)),
      );
    },
    [currentUserId],
  );

  const handleRemoveSubject = useCallback(
    (userId: number) => {
      if (userId === currentUserId) return;
      setLocalSubjects(prev => prev.filter(s => s.user_id !== userId));
    },
    [currentUserId],
  );

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const serverMap = new Map(
        serverSubjects.map(s => [s.user_id, s.permission]),
      );
      const localMap = new Map(
        localSubjects.map(s => [s.user_id, s.permission]),
      );

      const calls: Promise<unknown>[] = [];

      for (const [userId, permission] of localMap) {
        if (!serverMap.has(userId)) {
          calls.push(
            SupersetClient.post({
              endpoint: `/api/v1/folders/${folderUuid}/subjects`,
              jsonPayload: { user_id: userId, permission },
            }),
          );
        }
      }

      for (const [userId] of serverMap) {
        if (!localMap.has(userId)) {
          calls.push(
            SupersetClient.delete({
              endpoint: `/api/v1/folders/${folderUuid}/subjects/${userId}`,
            }),
          );
        }
      }

      for (const [userId, permission] of localMap) {
        const serverPerm = serverMap.get(userId);
        if (serverPerm && serverPerm !== permission) {
          calls.push(
            SupersetClient.put({
              endpoint: `/api/v1/folders/${folderUuid}/subjects/${userId}`,
              jsonPayload: { permission },
            }),
          );
        }
      }

      const results = await Promise.allSettled(calls);
      const failures = results.filter(r => r.status === 'rejected');
      if (failures.length > 0) {
        addDangerToast(t('%s permission update(s) failed', failures.length));
      } else {
        addSuccessToast(t('Permissions updated'));
      }
      onHide();
    } catch {
      addDangerToast(t('Error updating permissions'));
    } finally {
      setSaving(false);
    }
  }, [
    folderUuid,
    serverSubjects,
    localSubjects,
    addSuccessToast,
    addDangerToast,
    onHide,
  ]);

  const hasChanges = useMemo(() => {
    if (serverSubjects.length !== localSubjects.length) return true;
    const serverMap = new Map(
      serverSubjects.map(s => [s.user_id, s.permission]),
    );
    return localSubjects.some(s => serverMap.get(s.user_id) !== s.permission);
  }, [serverSubjects, localSubjects]);

  const fetchAvailableUsers = useCallback(
    async (
      search: string,
      page: number,
      pageSize: number,
    ): Promise<SelectOptionsTypePage> => {
      const params = new URLSearchParams({
        q: search,
        page: String(page),
        page_size: String(pageSize),
      });
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/folders/${folderUuid}/available-users?${params}`,
      });
      const results = json?.result || [];
      const newAdminIds = new Set(adminIds);
      results.forEach((u: { id: number; is_admin?: boolean }) => {
        if (u.is_admin) newAdminIds.add(u.id);
      });
      setAdminIds(newAdminIds);
      return {
        data: results.map(
          (u: { id: number; email: string; is_admin?: boolean }) => ({
            value: u.id,
            label: getUserLabel(u),
          }),
        ),
        totalCount: json?.count ?? 0,
      };
    },
    [folderUuid, adminIds],
  );

  const filtered = useMemo(() => {
    if (!memberSearch) return localSubjects;
    const q = memberSearch.toLowerCase();
    return localSubjects.filter(s => s.label.toLowerCase().includes(q));
  }, [localSubjects, memberSearch]);

  const columns: ColumnsType<LocalSubject> = useMemo(
    () => [
      {
        title: t('User'),
        dataIndex: 'label',
        key: 'label',
        render: (label: string, record: LocalSubject) => (
          <span>
            {label}
            {record.isCurrentUser && (
              <span css={{ opacity: 0.5, marginLeft: theme.sizeUnit }}>
                ({t('you')})
              </span>
            )}
          </span>
        ),
      },
      {
        title: t('Permission'),
        dataIndex: 'permission',
        key: 'permission',
        width: 130,
        render: (permission: Permission, record: LocalSubject) =>
          record.isAdmin ? (
            <Tooltip
              title={t(
                'This user is an admin and has full access to all folders',
              )}
            >
              <Typography.Text type="secondary">{t('Admin')}</Typography.Text>
            </Tooltip>
          ) : (
            <Select
              ariaLabel={t('Permission')}
              options={PERMISSION_OPTIONS}
              value={permission}
              disabled={record.isCurrentUser}
              onChange={(val: Permission) =>
                handleChangePermission(record.user_id, val)
              }
              getPopupContainer={trigger =>
                trigger.closest('.ant-modal-content') || document.body
              }
            />
          ),
      },
      {
        title: '',
        key: 'actions',
        width: 40,
        render: (_: unknown, record: LocalSubject) =>
          record.isCurrentUser || record.isAdmin ? null : (
            <Icons.DeleteOutlined
              iconSize="m"
              role="button"
              tabIndex={0}
              onClick={() => handleRemoveSubject(record.user_id)}
              css={css`
                cursor: pointer;
                color: ${theme.colorIcon};
                &:hover {
                  color: ${theme.colorError};
                }
              `}
            />
          ),
      },
    ],
    [theme, handleChangePermission, handleRemoveSubject],
  );

  return (
    <StandardModal
      title={t('Manage permissions — %s', folderName)}
      show={show}
      onHide={onHide}
      onSave={handleSave}
      saveText={t('Save')}
      saveLoading={saving}
      saveDisabled={!hasChanges}
      contentLoading={loading}
    >
      <ModalContent>
        {isSubfolder && (
          <Alert
            type="warning"
            showIcon
            message={t(
              'Changing permissions here will stop this folder from automatically inheriting updates from its parent. You can re-sync later from the actions menu.',
            )}
          />
        )}
        <div>
          <StyledFormLabel>{t('Add user')}</StyledFormLabel>
          <AsyncSelect
            ariaLabel={t('Search users')}
            placeholder={t('Search for a user…')}
            options={fetchAvailableUsers}
            onChange={handleAddUser}
            value={undefined}
            getPopupContainer={trigger =>
              trigger.closest('.ant-modal-content') || document.body
            }
          />
        </div>

        <div>
          <StyledFormLabel>
            {t('Members')} ({localSubjects.length})
          </StyledFormLabel>
          <Input
            placeholder={t('Search members…')}
            value={memberSearch}
            onChange={e => setMemberSearch(e.target.value)}
            allowClear
            css={{ marginBottom: theme.sizeUnit * 2 }}
          />
          <Table<LocalSubject>
            data={filtered}
            columns={columns}
            usePagination
            defaultPageSize={10}
            size={TableSize.Small}
            height={300}
          />
        </div>
      </ModalContent>
    </StandardModal>
  );
}
