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
import { FeatureFlag, isFeatureEnabled } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import { Select } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { AsyncModeOverride } from 'src/utils/asyncMode';

interface AsyncModeSectionProps {
  value: AsyncModeOverride;
  onChange: (value: AsyncModeOverride) => void;
}

const OPTIONS: { value: AsyncModeOverride; label: string }[] = [
  { value: 'default', label: t('Deployment default') },
  { value: 'force_on', label: t('Force enabled') },
  { value: 'force_off', label: t('Force disabled') },
];

/**
 * Per-dashboard override for asynchronous chart-data loading. Only shown when the
 * GLOBAL_ASYNC_QUERIES feature is enabled; persisted to json_metadata.async_mode.
 */
const AsyncModeSection = ({ value, onChange }: AsyncModeSectionProps) => {
  if (!isFeatureEnabled(FeatureFlag.GlobalAsyncQueries)) {
    return null;
  }
  return (
    <ModalFormField
      label={t('Asynchronous query execution')}
      helperText={t(
        "Whether this dashboard's charts load their data asynchronously. " +
          'Leave on the deployment default unless you need to force it on or off ' +
          'for this dashboard.',
      )}
      bottomSpacing={false}
    >
      <Select
        ariaLabel={t('Asynchronous query execution')}
        value={value}
        options={OPTIONS}
        onChange={val => onChange(val as AsyncModeOverride)}
      />
    </ModalFormField>
  );
};

export default AsyncModeSection;
