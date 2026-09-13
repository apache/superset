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
import { t } from '@apache-superset/core/translation';
import { Select } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { AsyncModeOverride } from 'src/utils/asyncMode';

interface AsyncModeSectionProps {
  value: AsyncModeOverride;
  onChange: (value: AsyncModeOverride) => void;
}

/**
 * Per-dashboard override for asynchronous chart-data loading, persisted to
 * json_metadata.async_mode. Rendered by the properties modal only while the
 * GLOBAL_ASYNC_QUERIES feature is enabled.
 */
const AsyncModeSection = ({ value, onChange }: AsyncModeSectionProps) => {
  const label = t('Asynchronous query execution');
  const options: { value: AsyncModeOverride; label: string }[] = [
    { value: 'default', label: t('Deployment default') },
    { value: 'force_on', label: t('Force enabled') },
    { value: 'force_off', label: t('Force disabled') },
  ];
  return (
    <ModalFormField
      label={label}
      helperText={t(
        'Leave on the deployment default unless you need to force ' +
          'asynchronous loading on or off for this dashboard.',
      )}
      bottomSpacing={false}
    >
      <Select
        ariaLabel={label}
        value={value}
        options={options}
        onChange={val => onChange(val as AsyncModeOverride)}
      />
    </ModalFormField>
  );
};

export default AsyncModeSection;
