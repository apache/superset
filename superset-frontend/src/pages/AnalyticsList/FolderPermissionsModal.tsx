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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import rison from 'rison';
import { SupersetClient } from '@superset-ui/core';
import { styled, css, useTheme } from '@apache-superset/core/theme';
import {
  AsyncSelect,
  Select,
  Tag,
  type SelectOptionsTypePage,
} from '@superset-ui/core/components';
import { StandardModal } from 'src/components/Modal';
import { Icons } from '@superset-ui/core/components/Icons';

type Permission = 'editor' | 'viewer';

interface Subject {
  user_id: number;
  permission: Permission;
}

interface LocalSubject extends Subject {
  label: string;
}

interface FolderPermissionsModalProps {
  folderUuid: string;
  folderName: string;
  currentUserId: number;
  show: boolean;
  onHide: () => void;
  addDangerToast: (msg: string) => void;
  addSuccessToast: (msg: string) => void;
}

const ModalContent = styled.div`
  ${({ theme }) => css`
    padding: ${theme.sizeUnit * 3}px ${theme.sizeUnit * 4}px;
    display: flex;
    flex-direction: column;
    gap: ${theme.sizeUnit * 3}px;
  `}
`;

const SubjectRow = styled.div<{ isCurrentUser?: boolean }>`
  ${({ theme, isCurrentUser }) => css`
    display: flex;
    align-items: center;
    gap: ${theme.sizeUnit * 2}px;
    padding: ${theme.sizeUnit * 2}px ${theme.sizeUnit * 3}px;
    border-radius: ${theme.borderRadius}px;
    ${isCurrentUser ? `opacity: 0.6;` : ''}

    &:hover {
      background: ${isCurrentUser ? 'transparent' : theme.colorBgTextHover};
    }

    .subject-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `}
`;

const SubjectList = styled.div`
  ${({ theme }) => css`
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid ${theme.colorBorderSecondary};
    border-radius: ${theme.borderRadius}px;
  `}
`;

const SectionLabel = styled.div`
  ${({ theme }) => css`
    font-weight: ${theme.fontWeightStrong};
    color: ${theme.colorTextLabel};
    font-size: ${theme.fontSizeSM}px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  `}
`;

const AddRow = styled.div`
  ${({ theme }) => css`
    display: flex;
    gap: ${theme.sizeUnit * 2}px;
    align-items: center;
  `}
`;

const PERMISSION_OPTIONS = [
  { value: 'viewer', label: t('Viewer') },
  { value: 'editor', label: t('Editor') },
];

async function fetchUserOptions(
  filterValue: string,
  page: number,
  pageSize: number,
): Promise<SelectOptionsTypePage> {
  const query = rison.encode({
    filter: filterValue,
    page,
    page_size: pageSize,
    order_column: 'username',
    order_direction: 'asc',
  });
  const { json } = await SupersetClient.get({
    endpoint: `/api/v1/security/users/?q=${query}`,
  });
  const results = json?.result || [];
  return {
    data: results.map(
      (u: {
        id: number;
        first_name: string;
        last_name: string;
        username: string;
      }) => ({
        value: u.id,
        label: `${u.first_name} ${u.last_name} (${u.username})`,
      }),
    ),
    totalCount: json?.count ?? 0,
  };
}

export default function FolderPermissionsModal({
  folderUuid,
  folderName,
  currentUserId,
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
  const [addPermission, setAddPermission] = useState<Permission>('viewer');

  const fetchSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const [subjectsRes, usersRes] = await Promise.all([
        SupersetClient.get({
          endpoint: `/api/v1/folders/${folderUuid}/subjects`,
        }),
        SupersetClient.get({
          endpoint: '/api/v1/security/users/?q=(page_size:1000,page:0)',
        }),
      ]);
      const subjects = (subjectsRes.json.result as Subject[]) || [];
      const users =
        (usersRes.json.result as {
          id: number;
          first_name: string;
          last_name: string;
          username: string;
        }[]) || [];
      const userMap = new Map(
        users.map(u => [
          u.id,
          `${u.first_name} ${u.last_name} (${u.username})`,
        ]),
      );

      const enriched: LocalSubject[] = subjects.map(s => ({
        ...s,
        label: userMap.get(s.user_id) || t('User %s', s.user_id),
      }));
      setServerSubjects(enriched);
      setLocalSubjects(enriched);
    } catch {
      addDangerToast(t('Error loading permissions'));
    } finally {
      setLoading(false);
    }
  }, [folderUuid, addDangerToast]);

  useEffect(() => {
    if (show) {
      fetchSubjects();
      setAddPermission('viewer');
    }
  }, [show, fetchSubjects]);

  const handleAddUser = useCallback(
    (value: number, option: { label: string }) => {
      if (!value) return;
      setLocalSubjects(prev => {
        if (prev.some(s => s.user_id === value)) return prev;
        return [
          ...prev,
          { user_id: value, permission: addPermission, label: option.label },
        ];
      });
    },
    [addPermission],
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

      await Promise.all(calls);
      addSuccessToast(t('Permissions updated'));
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

  const existingUserIdsRef = useRef(new Set<number>());
  existingUserIdsRef.current = new Set(localSubjects.map(s => s.user_id));

  const filteredUserOptions = useCallback(
    async (search: string, page: number, pageSize: number) => {
      const result = await fetchUserOptions(search, page, pageSize);
      return {
        ...result,
        data: result.data.filter(
          (opt: { value: number }) =>
            !existingUserIdsRef.current.has(opt.value),
        ),
      };
    },
    [],
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
    >
      <ModalContent>
        <div>
          <SectionLabel>{t('Add user')}</SectionLabel>
          <AddRow css={{ marginTop: theme.sizeUnit }}>
            <div css={{ flex: 1 }}>
              <AsyncSelect
                ariaLabel={t('Search users')}
                placeholder={t('Search for a user…')}
                options={filteredUserOptions}
                onSelect={(value: number, option: { label: string }) =>
                  handleAddUser(value, option)
                }
                value={null}
                getPopupContainer={trigger =>
                  trigger.closest('.ant-modal-content') || document.body
                }
              />
            </div>
            <Select
              ariaLabel={t('Permission level')}
              options={PERMISSION_OPTIONS}
              value={addPermission}
              onChange={(val: Permission) => setAddPermission(val)}
              css={{ width: 120 }}
              getPopupContainer={trigger =>
                trigger.closest('.ant-modal-content') || document.body
              }
            />
          </AddRow>
        </div>

        <div>
          <SectionLabel>
            {t('Members')} ({localSubjects.length})
          </SectionLabel>
          {loading ? (
            <p
              css={{
                color: theme.colorTextSecondary,
                padding: theme.sizeUnit * 2,
              }}
            >
              {t('Loading…')}
            </p>
          ) : localSubjects.length === 0 ? (
            <p
              css={{
                color: theme.colorTextSecondary,
                padding: theme.sizeUnit * 2,
              }}
            >
              {t('No permissions set. Add users above.')}
            </p>
          ) : (
            <SubjectList>
              {localSubjects.map(subject => {
                const isCurrentUser = subject.user_id === currentUserId;
                return (
                  <SubjectRow
                    key={subject.user_id}
                    isCurrentUser={isCurrentUser}
                  >
                    <Icons.UserOutlined
                      iconSize="m"
                      css={{ color: theme.colorIcon, flexShrink: 0 }}
                    />
                    <span className="subject-name">
                      {subject.label}
                      {isCurrentUser && (
                        <span
                          css={{
                            color: theme.colorTextSecondary,
                            fontSize: theme.fontSizeSM,
                            marginLeft: 4,
                          }}
                        >
                          ({t('you')})
                        </span>
                      )}
                    </span>
                    {isCurrentUser ? (
                      <Tag
                        color={
                          subject.permission === 'editor' ? 'blue' : 'green'
                        }
                      >
                        {subject.permission === 'editor'
                          ? t('Editor')
                          : t('Viewer')}
                      </Tag>
                    ) : (
                      <>
                        <Select
                          ariaLabel={t('Permission')}
                          options={PERMISSION_OPTIONS}
                          value={subject.permission}
                          onChange={(val: Permission) =>
                            handleChangePermission(subject.user_id, val)
                          }
                          css={{ width: 110 }}
                          getPopupContainer={trigger =>
                            trigger.closest('.ant-modal-content') ||
                            document.body
                          }
                        />
                        <Icons.DeleteOutlined
                          iconSize="m"
                          role="button"
                          tabIndex={0}
                          onClick={() => handleRemoveSubject(subject.user_id)}
                          onKeyDown={(e: React.KeyboardEvent) => {
                            if (e.key === 'Enter')
                              handleRemoveSubject(subject.user_id);
                          }}
                          css={css`
                            cursor: pointer;
                            color: ${theme.colorIcon};
                            flex-shrink: 0;
                            &:hover {
                              color: ${theme.colorError};
                            }
                          `}
                        />
                      </>
                    )}
                  </SubjectRow>
                );
              })}
            </SubjectList>
          )}
        </div>
      </ModalContent>
    </StandardModal>
  );
}
