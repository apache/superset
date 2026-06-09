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
import { useCallback, useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { SupersetClient } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import { Button, Input } from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';

type Permission = 'editor' | 'viewer';

interface Subject {
  user_id: number;
  permission: Permission;
}

interface UserOption {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
}

interface FolderPermissionsModalProps {
  folderUuid: string;
  folderName: string;
  show: boolean;
  onHide: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
  `}
`;

const SubjectRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${theme.sizeUnit * 2}px 0;
    border-bottom: 1px solid ${theme.colorBorderSecondary};

    .subject-info {
      display: flex;
      align-items: center;
      gap: ${theme.sizeUnit * 2}px;
    }

    .permission-badge {
      padding: ${theme.sizeUnit / 2}px ${theme.sizeUnit * 2}px;
      border-radius: ${theme.borderRadius}px;
      font-size: ${theme.fontSizeSM}px;
      font-weight: ${theme.fontWeightStrong};
      cursor: pointer;
    }

    .permission-editor {
      background: ${theme.colorInfoBg};
      color: ${theme.colorInfo};
    }

    .permission-viewer {
      background: ${theme.colorSuccessBg};
      color: ${theme.colorSuccess};
    }

    .remove-button {
      cursor: pointer;
      color: ${theme.colorIcon};
      &:hover {
        color: ${theme.colorError};
      }
    }
  `}
`;

const UserList = styled.div`
  ${({ theme }) => css`
    max-height: 200px;
    overflow-y: auto;
    margin-top: ${theme.sizeUnit * 2}px;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;

    .user-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;

      &:hover {
        background: ${theme.colorBgTextHover};
      }

      .user-info {
        display: flex;
        align-items: center;
        gap: ${theme.sizeUnit * 2}px;
      }

      .add-actions {
        display: flex;
        gap: ${theme.sizeUnit}px;
      }
    }
  `}
`;

const SectionLabel = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
    margin-top: ${theme.sizeUnit * 4}px;
    margin-bottom: ${theme.sizeUnit * 2}px;
  `}
`;

export default function FolderPermissionsModal({
  folderUuid,
  folderName,
  show,
  onHide,
  addDangerToast,
  addSuccessToast,
}: FolderPermissionsModalProps) {
  const theme = useTheme();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [allUsers, setAllUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const { json } = await SupersetClient.get({
        endpoint: `/api/v1/folders/${folderUuid}/subjects`,
      });
      setSubjects((json.result as Subject[]) || []);
    } catch {
      addDangerToast(t('Error loading permissions'));
    } finally {
      setLoading(false);
    }
  }, [folderUuid, addDangerToast]);

  const fetchUsers = useCallback(async () => {
    try {
      const { json } = await SupersetClient.get({
        endpoint: '/api/v1/security/users/?q=(page_size:100,page:0)',
      });
      setAllUsers((json.result as UserOption[]) || []);
    } catch {
      addDangerToast(t('Error loading users'));
    }
  }, [addDangerToast]);

  useEffect(() => {
    if (show) {
      fetchSubjects();
      fetchUsers();
      setSearch('');
    }
  }, [show, fetchSubjects, fetchUsers]);

  const handleAddSubject = useCallback(
    async (userId: number, permission: Permission) => {
      try {
        await SupersetClient.post({
          endpoint: `/api/v1/folders/${folderUuid}/subjects`,
          jsonPayload: { user_id: userId, permission },
        });
        addSuccessToast(t('Permission added'));
        fetchSubjects();
      } catch {
        addDangerToast(t('Error adding permission'));
      }
    },
    [folderUuid, addSuccessToast, addDangerToast, fetchSubjects],
  );

  const handleTogglePermission = useCallback(
    async (userId: number, currentPermission: Permission) => {
      const newPerm: Permission =
        currentPermission === 'viewer' ? 'editor' : 'viewer';
      try {
        await SupersetClient.put({
          endpoint: `/api/v1/folders/${folderUuid}/subjects/${userId}`,
          jsonPayload: { permission: newPerm },
        });
        addSuccessToast(t('Permission updated'));
        fetchSubjects();
      } catch {
        addDangerToast(t('Error updating permission'));
      }
    },
    [folderUuid, addSuccessToast, addDangerToast, fetchSubjects],
  );

  const handleRemoveSubject = useCallback(
    async (userId: number) => {
      try {
        await SupersetClient.delete({
          endpoint: `/api/v1/folders/${folderUuid}/subjects/${userId}`,
        });
        addSuccessToast(t('Permission removed'));
        fetchSubjects();
      } catch {
        addDangerToast(t('Error removing permission'));
      }
    },
    [folderUuid, addSuccessToast, addDangerToast, fetchSubjects],
  );

  const subjectUserIds = new Set(subjects.map(s => s.user_id));

  const availableUsers = allUsers.filter(u => {
    if (subjectUserIds.has(u.id)) return false;
    if (!search) return true;
    const name = `${u.first_name} ${u.last_name} ${u.username}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const getUserName = (userId: number) => {
    const user = allUsers.find(u => u.id === userId);
    if (user) return `${user.first_name} ${user.last_name}`;
    return t('User %s', userId);
  };

  return (
    <StandardModal
      title={t('Manage permissions — %s', folderName)}
      show={show}
      onHide={onHide}
      onSave={onHide}
      saveText={t('Done')}
    >
      <ModalContent>
        <SectionLabel>
          {t('Current permissions')} ({subjects.length})
        </SectionLabel>
        {loading ? (
          <p>{t('Loading...')}</p>
        ) : subjects.length === 0 ? (
          <p css={{ color: theme.colorTextSecondary }}>
            {t('No permissions set on this folder.')}
          </p>
        ) : (
          subjects.map(subject => (
            <SubjectRow key={subject.user_id}>
              <div className="subject-info">
                <Icons.UserOutlined iconSize="m" />
                <span>{getUserName(subject.user_id)}</span>
                <span
                  className={`permission-badge permission-${subject.permission}`}
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    handleTogglePermission(subject.user_id, subject.permission)
                  }
                  onKeyDown={e => {
                    if (e.key === 'Enter')
                      handleTogglePermission(
                        subject.user_id,
                        subject.permission,
                      );
                  }}
                  title={t('Click to toggle')}
                >
                  {subject.permission}
                </span>
              </div>
              <div className="subject-actions">
                <span
                  className="remove-button"
                  role="button"
                  tabIndex={0}
                  onClick={() => handleRemoveSubject(subject.user_id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRemoveSubject(subject.user_id);
                  }}
                >
                  <Icons.DeleteOutlined iconSize="m" />
                </span>
              </div>
            </SubjectRow>
          ))
        )}

        <SectionLabel>{t('Add users')}</SectionLabel>
        <Input
          placeholder={t('Search users...')}
          value={search}
          onChange={e => setSearch(e.target.value)}
          allowClear
        />
        <UserList>
          {availableUsers.length === 0 ? (
            <p css={{ padding: 12, color: theme.colorTextSecondary }}>
              {search ? t('No users found') : t('All users already added')}
            </p>
          ) : (
            availableUsers.map(user => (
              <div className="user-row" key={user.id}>
                <div className="user-info">
                  <Icons.UserOutlined iconSize="m" />
                  <span>
                    {user.first_name} {user.last_name}
                  </span>
                  <span css={{ color: theme.colorTextSecondary, fontSize: 12 }}>
                    @{user.username}
                  </span>
                </div>
                <div className="add-actions">
                  <Button
                    buttonStyle="secondary"
                    buttonSize="xsmall"
                    onClick={() => handleAddSubject(user.id, 'viewer')}
                  >
                    + {t('Viewer')}
                  </Button>
                  <Button
                    buttonStyle="secondary"
                    buttonSize="xsmall"
                    onClick={() => handleAddSubject(user.id, 'editor')}
                  >
                    + {t('Editor')}
                  </Button>
                </div>
              </div>
            ))
          )}
        </UserList>
      </ModalContent>
    </StandardModal>
  );
}
