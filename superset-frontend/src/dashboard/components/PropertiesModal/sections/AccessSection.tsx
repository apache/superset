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
import { useMemo } from 'react';
import { isFeatureEnabled, FeatureFlag, t } from '@superset-ui/core';
import { AsyncSelect } from '@superset-ui/core/components';
import { type TagType } from 'src/components';
import { loadTags } from 'src/components/Tag/utils';
import getOwnerName from 'src/utils/getOwnerName';
import Owner from 'src/types/Owner';
import { ModalFormField } from 'src/components/Modal';
import { useAccessOptions } from '../hooks/useAccessOptions';

type Roles = { id: number; name: string }[];
type Owners = {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
}[];

interface AccessSectionProps {
  isLoading: boolean;
  owners: Owners;
  roles: Roles;
  tags: TagType[];
  onChangeOwners: (owners: { value: number; label: string }[]) => void;
  onChangeRoles: (roles: { value: number; label: string }[]) => void;
  onChangeTags: (tags: { label: string; value: number }[]) => void;
  onClearTags: () => void;
}

const AccessSection = ({
  isLoading,
  owners,
  roles,
  tags,
  onChangeOwners,
  onChangeRoles,
  onChangeTags,
  onClearTags,
}: AccessSectionProps) => {
  const { loadAccessOptions } = useAccessOptions();

  const ownersSelectValue = useMemo(
    () =>
      (owners || []).map((owner: Owner) => ({
        value: owner.id,
        label: getOwnerName(owner),
      })),
    [owners],
  );

  const rolesSelectValue = useMemo(
    () =>
      (roles || []).map((role: { id: number; name: string }) => ({
        value: role.id,
        label: `${role.name}`,
      })),
    [roles],
  );

  const tagsAsSelectValues = useMemo(
    () =>
      tags.map((tag: { id: number; name: string }) => ({
        value: tag.id,
        label: tag.name,
      })),
    [tags],
  );

  return (
    <>
      <ModalFormField
        label={t('Owners')}
        helperText={t(
          'Owners is a list of users who can alter the dashboard. Searchable by name or username.',
        )}
      >
        <AsyncSelect
          allowClear
          ariaLabel={t('Owners')}
          disabled={isLoading}
          mode="multiple"
          onChange={onChangeOwners}
          options={(input, page, pageSize) =>
            loadAccessOptions('owners', input, page, pageSize)
          }
          value={ownersSelectValue}
          showSearch
          placeholder={t('Search owners')}
        />
      </ModalFormField>
      {isFeatureEnabled(FeatureFlag.DashboardRbac) && (
        <ModalFormField
          label={t('Roles')}
          helperText={t(
            'Roles is a list which defines access to the dashboard. Granting a role access to a dashboard will bypass dataset level checks. If no roles are defined, regular access permissions apply.',
          )}
          bottomSpacing={!isFeatureEnabled(FeatureFlag.TaggingSystem)}
        >
          <AsyncSelect
            allowClear
            ariaLabel={t('Roles')}
            disabled={isLoading}
            mode="multiple"
            onChange={onChangeRoles}
            options={(input, page, pageSize) =>
              loadAccessOptions('roles', input, page, pageSize)
            }
            value={rolesSelectValue}
            showSearch
            placeholder={t('Search roles')}
          />
        </ModalFormField>
      )}
      {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
        <ModalFormField
          label={t('Tags')}
          helperText={t(
            'A list of tags that have been applied to this dashboard.',
          )}
          bottomSpacing={false}
        >
          <AsyncSelect
            ariaLabel="Tags"
            mode="multiple"
            value={tagsAsSelectValues}
            options={loadTags}
            onChange={onChangeTags}
            onClear={onClearTags}
            allowClear
            showSearch
            placeholder={t('Search tags')}
          />
        </ModalFormField>
      )}
    </>
  );
};

export default AccessSection;
