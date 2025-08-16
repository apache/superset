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
import { t } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import { ModalFormField } from 'src/components/Modal';

interface RefreshSectionProps {
  refreshFrequency: number;
  onRefreshFrequencyChange: (value: any) => void;
}

const RefreshSection = ({
  refreshFrequency,
  onRefreshFrequencyChange,
}: RefreshSectionProps) => (
  <ModalFormField
    label={t('Refresh frequency')}
    helperText={t(
      'Set the automatic refresh frequency for this dashboard. The dashboard will reload its data at the specified interval.',
    )}
    bottomSpacing={false}
  >
    <Select
      ariaLabel={t('Refresh frequency')}
      value={refreshFrequency}
      onChange={onRefreshFrequencyChange}
      options={[
        { value: 0, label: t("Don't refresh") },
        { value: 10, label: t('10 seconds') },
        { value: 30, label: t('30 seconds') },
        { value: 60, label: t('1 minute') },
        { value: 300, label: t('5 minutes') },
        { value: 1800, label: t('30 minutes') },
        { value: 3600, label: t('1 hour') },
        { value: 21600, label: t('6 hours') },
        { value: 43200, label: t('12 hours') },
        { value: 86400, label: t('24 hours') },
      ]}
    />
  </ModalFormField>
);

export default RefreshSection;
