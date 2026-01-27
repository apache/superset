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
import { t } from '@apache-superset/core';
import { Input } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';
import { EmptyStateConfig } from 'src/dashboard/types/EmptyStateConfig';

interface EmptyStateSectionProps {
  emptyStateConfig: EmptyStateConfig;
  onEmptyStateConfigChange: (config: EmptyStateConfig) => void;
}

export const EmptyStateSection = ({
  emptyStateConfig,
  onEmptyStateConfigChange,
}: EmptyStateSectionProps) => {
  const handleChange = (field: keyof EmptyStateConfig, value: string) => {
    onEmptyStateConfigChange({
      ...emptyStateConfig,
      [field]: value || undefined, // Convert empty string to undefined
    });
  };

  return (
    <>
      <ModalFormField
        label={t('Empty state message')}
        helperText={t(
          'Custom message displayed when charts have no data. Leave blank to use default message.',
        )}
      >
        <Input
          aria-label={t('Empty state message')}
          value={emptyStateConfig.no_data_message || ''}
          onChange={e => handleChange('no_data_message', e.target.value)}
          placeholder={t('Default: No data')}
        />
      </ModalFormField>

      <ModalFormField
        label={t('Empty state subtitle')}
        helperText={t(
          'Additional description shown below the empty state message.',
        )}
      >
        <Input.TextArea
          aria-label={t('Empty state subtitle')}
          value={emptyStateConfig.no_data_subtitle || ''}
          onChange={e => handleChange('no_data_subtitle', e.target.value)}
          placeholder={t(
            'Default: No data after filtering or data is NULL for the latest time record',
          )}
          rows={2}
        />
      </ModalFormField>

      <ModalFormField
        label={t('No results message')}
        helperText={t(
          'Message displayed when query returns no results after filtering.',
        )}
      >
        <Input
          aria-label={t('No results message')}
          value={emptyStateConfig.no_results_message || ''}
          onChange={e => handleChange('no_results_message', e.target.value)}
          placeholder={t('Default: No results were returned for this query')}
        />
      </ModalFormField>

      <ModalFormField
        label={t('No results subtitle')}
        helperText={t(
          'Additional description shown below the no results message.',
        )}
      >
        <Input.TextArea
          aria-label={t('No results subtitle')}
          value={emptyStateConfig.no_results_subtitle || ''}
          onChange={e => handleChange('no_results_subtitle', e.target.value)}
          placeholder={t(
            'Default: Make sure that the controls are configured properly and the datasource contains data for the selected time range',
          )}
          rows={2}
        />
      </ModalFormField>
    </>
  );
};
