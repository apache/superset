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
import { t } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import { AsyncSelect } from '@superset-ui/core/components';
import { type TagType } from 'src/components';
import { loadTags } from 'src/components/Tag/utils';
import Subject from 'src/types/Subject';
import { ModalFormField } from 'src/components/Modal';
import SubjectPicker, {
  mapSubjectsToPickerValues,
  type SubjectPickerValue,
} from 'src/features/subjects/SubjectPicker';

type Roles = { id: number; name: string }[];
type Owners = {
  id: number;
  full_name?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}[];

interface AccessSectionProps {
  isLoading: boolean;
  owners: Owners;
  roles: Roles;
  tags: TagType[];
  editors?: Subject[];
  viewers?: Subject[];
  onChangeOwners: (
    owners: { value: number; label: string }[],
    options: Record<string, unknown>[],
  ) => void;
  onChangeRoles: (roles: { value: number; label: string }[]) => void;
  onChangeEditors?: (editors: SubjectPickerValue[]) => void;
  onChangeViewers?: (viewers: SubjectPickerValue[]) => void;
  onChangeTags: (tags: { label: string; value: number }[]) => void;
  onClearTags: () => void;
}

const AccessSection = ({
  isLoading,
  owners,
  roles,
  tags,
  editors,
  viewers,
  onChangeOwners,
  onChangeRoles,
  onChangeEditors,
  onChangeViewers,
  onChangeTags,
  onClearTags,
}: AccessSectionProps) => {
  const enableViewers = isFeatureEnabled(FeatureFlag.EnableViewers);

  const editorsSelectValue = useMemo(
    () => mapSubjectsToPickerValues(editors || []),
    [editors],
  );

  const viewersSelectValue = useMemo(
    () => mapSubjectsToPickerValues(viewers || []),
    [viewers],
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
        label={t('Editors')}
        testId="dashboard-editors-field"
        helperText={t(
          'Editors is a list of subjects who can alter the dashboard. Searchable by name.',
        )}
      >
        <SubjectPicker
          relatedUrl="/api/v1/dashboard/related/editors"
          dataTest="dashboard-editors-select"
          allowClear
          ariaLabel={t('Editors')}
          disabled={isLoading}
          onChange={onChangeEditors!}
          value={editorsSelectValue}
          placeholder={t('Search editors')}
        />
      </ModalFormField>
      {enableViewers && (
        <ModalFormField
          label={t('Viewers')}
          testId="dashboard-viewers-field"
          helperText={t(
            'Viewers is a list of subjects who can view the dashboard. If no viewers are defined, the dashboard is accessible to all users with appropriate datasource permissions.',
          )}
        >
          <SubjectPicker
            relatedUrl="/api/v1/dashboard/related/viewers"
            dataTest="dashboard-viewers-select"
            allowClear
            ariaLabel={t('Viewers')}
            disabled={isLoading}
            onChange={onChangeViewers!}
            value={viewersSelectValue}
            placeholder={t('Search viewers')}
          />
        </ModalFormField>
      )}
      {isFeatureEnabled(FeatureFlag.TaggingSystem) && (
        <ModalFormField
          label={t('Tags')}
          testId="dashboard-tags-field"
          helperText={t(
            'A list of tags that have been applied to this dashboard.',
          )}
          bottomSpacing={false}
        >
          <AsyncSelect
            data-test="dashboard-tags-select"
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
