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
import { escape } from 'lodash-es';
import { t } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';

export interface ToastContent {
  text: string;
  options?: { allowHtml?: boolean };
}

/**
 * The soft-delete retention window in days, as resolved by the server.
 *
 * The value is computed rather than read from static config, so it reflects a
 * runtime override applied with `superset deletion-retention set_window`. It is
 * absent when the SOFT_DELETE feature is off, and `0` means retention is
 * disabled — archived objects are kept indefinitely, which is a recoverability
 * promise rather than the lack of one. Both cases return 0 here because the
 * copy is the same: recoverable, with no time bound to quote.
 *
 * Drives how the delete-confirmation modal phrases recoverability (sc-111760).
 */
export function getSoftDeleteRetentionDays(): number {
  const conf = getBootstrapData()?.common?.conf as
    | Record<string, unknown>
    | undefined;
  const raw = conf?.SOFT_DELETE_RETENTION_DAYS;
  if (raw === undefined || raw === null) {
    return 0;
  }
  const days = Number(raw);
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
  // Each case is a single, complete translation unit (rather than two joined
  // fragments) so translators control the whole sentence; only the noun and the
  // day count are interpolated, matching Superset's existing `%(...)s` usage.
  const days = getSoftDeleteRetentionDays();
  if (days) {
    return plural
      ? t(
          'These %(type)s will be moved to Recently Archived. You can recover them there within %(days)s days.',
          { type: typeLabel, days },
        )
      : t(
          'This %(type)s will be moved to Recently Archived. You can recover it there within %(days)s days.',
          { type: typeLabel, days },
        );
  }
  return plural
    ? t(
        'These %(type)s will be moved to Recently Archived. You can recover them there.',
        { type: typeLabel },
      )
    : t(
        'This %(type)s will be moved to Recently Archived. You can recover it there.',
        { type: typeLabel },
      );
}

/**
 * Label for the delete affordance on list rows and bulk actions: "Archive"
 * when soft-delete is on (the action is recoverable), "Delete" when it is
 * off. One home for the vocabulary fork so a rename lands once.
 */
export function deleteActionLabel(): string {
  return isFeatureEnabled(FeatureFlag.SoftDelete) ? t('Archive') : t('Delete');
}

/** Success toast for a completed delete (archive) of a named object. */
export function deletedToast(name: string): string {
  return isFeatureEnabled(FeatureFlag.SoftDelete)
    ? t('Archived: %s', name)
    : t('Deleted: %s', name);
}

/**
 * Failure toast for a delete (archive) of a named object. Each branch is a
 * complete translation unit; the helper only chooses between them. `errMsg`
 * is whatever the error handler extracted -- `createErrorHandler` can hand
 * over a string or a structured record, and `t()` interpolates either, so
 * the type stays as wide as the call sites it replaced.
 */
export function deleteFailedToast(
  name: string,
  errMsg?: string | Record<string, string | string[]>,
): string {
  const softDelete = isFeatureEnabled(FeatureFlag.SoftDelete);
  if (errMsg === undefined || errMsg === null || errMsg === '') {
    return softDelete
      ? t('There was an issue archiving: %s', name)
      : t('There was an issue deleting: %s', name);
  }
  return softDelete
    ? t('There was an issue archiving %s: %s', name, errMsg)
    : t('There was an issue deleting %s: %s', name, errMsg);
}

/**
 * Success-toast content for a recovery. When the restored asset has a link
 * (`url`), the toast carries a "View <type>" anchor (HTML is escaped before
 * opting into `allowHtml`); otherwise it's a plain message.
 */
export function recoveredToast(
  name: string,
  typeLabel: string,
  url?: string | null,
): ToastContent {
  const message = t('%(name)s restored successfully', { name });
  if (!url) {
    return { text: message };
  }
  const linkText = t('View %(type)s', { type: typeLabel });
  return {
    text: `${escape(message)} <a href="${escape(url)}">${escape(linkText)} →</a>`,
    options: { allowHtml: true },
  };
}
