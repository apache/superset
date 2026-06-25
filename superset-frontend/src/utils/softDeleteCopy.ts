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
import getBootstrapData from 'src/utils/getBootstrapData';

/**
 * The configured soft-delete retention window (days) surfaced in the client
 * bootstrap config, or 0 when purging is disabled / unset. Drives how the
 * delete-confirmation modal phrases recoverability (sc-111760).
 */
export function getSoftDeleteRetentionDays(): number {
  const conf = getBootstrapData()?.common?.conf as
    | Record<string, unknown>
    | undefined;
  const days = Number(conf?.SUPERSET_SOFT_DELETE_RETENTION_DAYS);
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/**
 * Body copy for a recoverable (soft-delete) delete confirmation. `typeLabel`
 * is the lowercase noun for the object(s), e.g. "chart" or "charts". When the
 * retention window is disabled (0), the time-bound clause is omitted.
 */
export function archiveConfirmDescription(
  typeLabel: string,
  plural = false,
): string {
  const days = getSoftDeleteRetentionDays();
  const moved = plural
    ? t('These %(type)s will be moved to Recently Archived.', {
        type: typeLabel,
      })
    : t('This %(type)s will be moved to Recently Archived.', {
        type: typeLabel,
      });
  let recover: string;
  if (days) {
    recover = plural
      ? t('You can recover them there within %(days)s days.', { days })
      : t('You can recover it there within %(days)s days.', { days });
  } else {
    recover = plural
      ? t('You can recover them there.')
      : t('You can recover it there.');
  }
  return `${moved} ${recover}`;
}
