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
import { useEffect, useState } from 'react';
import { t } from '@apache-superset/core/translation';
import { Alert } from '@apache-superset/core/components';
import { SupersetClient } from '@superset-ui/core';
import { Select } from '@superset-ui/core/components';
import { TeamsDestination } from '../types';

interface TeamsDestinationSelectProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export default function TeamsDestinationSelect({
  value,
  onChange,
  disabled = false,
}: TeamsDestinationSelectProps) {
  const [destinations, setDestinations] = useState<TeamsDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    SupersetClient.get({ endpoint: '/api/v1/report/teams_destinations/' })
      .then(({ json }) => {
        if (!cancelled) setDestinations(json.result);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedDestination = destinations.find(item => item.key === value);
  const savedDestinationUnavailable =
    Boolean(value) && !loading && !loadFailed && !selectedDestination;
  const installationRequired =
    selectedDestination !== undefined && !selectedDestination.available;
  const options = destinations.map(destination => ({
    value: destination.key,
    label: destination.available
      ? destination.label
      : t('%s (Bot installation required)', destination.label),
  }));
  if (value && !selectedDestination) {
    options.push({
      value,
      label: loading || loadFailed ? value : t('%s (Unavailable)', value),
    });
  }

  return (
    <>
      <Select
        ariaLabel={t('Teams destination')}
        placeholder={t('Select an approved Teams channel')}
        options={options.map(option => ({
          ...option,
          disabled: savedDestinationUnavailable && option.value === value,
        }))}
        value={value || undefined}
        onChange={onChange}
        loading={loading}
        disabled={disabled || loadFailed}
        showSearch
      />
      {loadFailed && (
        <Alert
          type="error"
          message={t(
            'Unable to load Teams destinations. Try reopening this dialog.',
          )}
        />
      )}
      {savedDestinationUnavailable && (
        <Alert
          type="warning"
          message={t(
            'This saved Teams destination is unavailable. Ask your administrator to restore it or choose another destination.',
          )}
        />
      )}
      {installationRequired && (
        <Alert
          type="warning"
          message={t(
            'Install the notification bot in the approved team before delivery. You can save this alert, but delivery requires an active installation.',
          )}
        />
      )}
      {!loading && !loadFailed && !destinations.length && !value && (
        <Alert
          type="info"
          message={t(
            'No approved Teams destinations are configured. Contact your administrator.',
          )}
        />
      )}
    </>
  );
}
