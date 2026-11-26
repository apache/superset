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
import { Label, Tooltip } from '@superset-ui/core/components';
import { Icons } from '@superset-ui/core/components/Icons';
import {
  useDataFreshness,
  useDataFreshnessTimezone,
  useShowDataFreshness,
} from './hooks';
import type { DatasetFreshness } from './types';
import { formatDataAsOf, fromNow } from './utils';

const describeDataset = (
  dataset: DatasetFreshness,
  timezone: string | undefined,
): string => {
  if (!dataset.data_as_of) {
    return t('%s: unknown', dataset.name);
  }
  const when = t(
    '%s: %s (%s)',
    dataset.name,
    formatDataAsOf(dataset.data_as_of, timezone),
    fromNow(dataset.data_as_of),
  );
  return dataset.stale
    ? t('%s, older than %s minutes', when, dataset.warn_after_minutes)
    : when;
};

/**
 * Dashboard header label showing when the oldest source data on the dashboard
 * was loaded, with each dataset's answer in the tooltip.
 */
export const DataFreshnessLabel = () => {
  const show = useShowDataFreshness();
  const freshness = useDataFreshness();
  const timezone = useDataFreshnessTimezone();

  if (!show || !freshness?.data_as_of) {
    return null;
  }

  const tooltip = (
    <div data-test="data-freshness-tooltip">
      <div>{t('When the source data was last loaded')}</div>
      {freshness.datasets.map(dataset => (
        <div key={dataset.id}>{describeDataset(dataset, timezone)}</div>
      ))}
    </div>
  );

  return (
    <Tooltip title={tooltip} placement="bottom">
      <Label
        type={freshness.stale ? 'warning' : 'default'}
        icon={
          freshness.stale ? (
            <Icons.WarningOutlined iconSize="s" />
          ) : (
            <Icons.FieldTimeOutlined iconSize="s" />
          )
        }
        data-test="data-freshness-label"
      >
        {t('Data as of %s', formatDataAsOf(freshness.data_as_of, timezone))}
      </Label>
    </Tooltip>
  );
};

export default DataFreshnessLabel;
