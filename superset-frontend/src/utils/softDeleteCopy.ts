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
import { createElement, Fragment, ReactElement } from 'react';
import { escape } from 'lodash-es';
import { t, tn } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';
import { LocalStorageKeys, setItem } from 'src/utils/localStorageHelpers';
import { ensureAppRoot } from 'src/utils/navigationUtils';

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
  if (days === -1) {
    return -1;
  }
  return Number.isFinite(days) && days > 0 ? days : 0;
}

/**
 * Whether this delete is held rather than applied, resolving "has not been
 * told" to the flag.
 *
 * Exported because a dialog's *title* has to agree with its body, and the
 * title is written by the call site: "Archive X?" over a sentence saying the
 * delete needs review first was the first half of B1.
 *
 * `governed` is what `core/deferredWrites` answered for this one asset. It is
 * `undefined` for an asset nothing has been asked about, and for the moment
 * before an answer lands, and in both cases the flag is the best the host
 * has -- which is also the wording that was here before any of this.
 */
export function deleteIsGoverned(governed?: boolean): boolean {
  return governed ?? isFeatureEnabled(FeatureFlag.ChangeManagement);
}

/**
 * Body copy for a recoverable (soft-delete) delete confirmation. `typeLabel`
 * is the lowercase noun for the object(s), e.g. "chart" or "charts". When the
 * retention window is disabled (0), the time-bound clause is omitted.
 *
 * `governed` says whether this particular delete is held. It has to be passed
 * wherever a delete may be exempt from being held: that delete applies at
 * once, and this dialog promised a review for it anyway (B1). See
 * `core/deferredWrites` for where the answer comes from.
 */
export function archiveConfirmDescription(
  typeLabel: string,
  plural = false,
  governed?: boolean,
): string {
  // Each case is a single, complete translation unit (rather than two joined
  // fragments) so translators control the whole sentence; only the noun and the
  // day count are interpolated, matching Superset's existing `%(...)s` usage.
  // The timed variants pluralize on the day count (`tn`) because the retention
  // window accepts 1: "within 1 days" is exactly the copy defect this module
  // exists to prevent.
  if (deleteIsGoverned(governed)) {
    // Pressing this archives nothing. The delete is recorded and the asset
    // stays exactly where it is until somebody releases it, so a dialog
    // promising Recently Archived describes an outcome that will not happen
    // -- and the toast that follows then contradicts it.
    //
    // The converse is the defect `governed` exists for: said over an exempt
    // asset, these sentences promise a review that will not happen and a row
    // that is about to be gone.
    //
    // Said without a day count or a recovery route, because neither applies
    // yet: both belong to the archive this has not reached.
    return plural
      ? t(
          'These %(type)s need review before they are removed. Nothing is removed yet, and viewers keep seeing them until a reviewer approves.',
          { type: typeLabel },
        )
      : t(
          'This %(type)s needs review before it is removed. Nothing is removed yet, and viewers keep seeing it until a reviewer approves.',
          { type: typeLabel },
        );
  }
  const days = getSoftDeleteRetentionDays();
  if (days === -1) {
    return plural
      ? t(
          'These %(type)s will be moved to Recently Archived and may be permanently deleted on the next cleanup run.',
          { type: typeLabel },
        )
      : t(
          'This %(type)s will be moved to Recently Archived and may be permanently deleted on the next cleanup run.',
          { type: typeLabel },
        );
  }
  if (days) {
    return plural
      ? tn(
          'These %(type)s will be moved to Recently Archived. You can recover them there within %(days)s day.',
          'These %(type)s will be moved to Recently Archived. You can recover them there within %(days)s days.',
          days,
          { type: typeLabel, days },
        )
      : tn(
          'This %(type)s will be moved to Recently Archived. You can recover it there within %(days)s day.',
          'This %(type)s will be moved to Recently Archived. You can recover it there within %(days)s days.',
          days,
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
 * The label on the confirm button of a delete dialog.
 *
 * Separate from `deleteActionLabel`, which names the control that *opens* the
 * dialog. This one names the act about to happen when it is pressed, and it
 * is the thing the person actually clicks.
 *
 * It needed saying because the modal's own default for a recoverable delete
 * is "Archive", and no surface overrode it -- so a held delete offered an
 * "Archive" button under a body reading "needs review before it is removed.
 * Nothing is removed yet."
 */
export function deleteConfirmLabel(governed?: boolean): string {
  if (deleteIsGoverned(governed)) {
    return t('Request removal');
  }
  return isFeatureEnabled(FeatureFlag.SoftDelete) ? t('Archive') : t('Delete');
}

/**
 * Label for the delete affordance on list rows and bulk actions: "Archive"
 * when soft-delete is on (the action is recoverable), "Delete" when it is
 * off. One home for the vocabulary fork so a rename lands once.
 */
export function deleteActionLabel(governed?: boolean): string {
  // When the delete is held, pressing this archives nothing and deletes
  // nothing: it records a request that a second person has to release.
  // "Archive" named an outcome that does not happen, and sat on the same
  // dialog as a body saying the asset needs review before it is removed --
  // the control promising one thing and the sentence under it another.
  //
  // `governed` for the same reason the description takes it: on an exempt
  // asset this control does remove the thing, and calling it "Request
  // removal" was the label half of B1. A label cannot hedge, so it has to be
  // told.
  if (deleteIsGoverned(governed)) {
    return t('Request removal');
  }
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

type ArchivedObjectType = 'chart' | 'dashboard' | 'dataset';

/** Build a collection URL beneath the configured application root. */
function archiveHref(type: ArchivedObjectType): string {
  return ensureAppRoot(`/archived/?type=${type}`);
}

/** Explain where recovery is available without leaving the confirmation. */
export function archiveConfirmContent(
  _type: ArchivedObjectType,
  typeLabel: string,
  plural = false,
): ReactElement {
  return createElement(
    Fragment,
    null,
    archiveConfirmDescription(typeLabel, plural),
  );
}

/** Remember the collection after a successful recoverable archive. */
export function rememberArchivedType(type: ArchivedObjectType): void {
  if (isFeatureEnabled(FeatureFlag.SoftDelete)) {
    setItem(LocalStorageKeys.LastArchivedType, type);
  }
}

/** Build an escaped success toast linking to the archived collection. */
export function archiveToastContent(
  text: string,
  type: ArchivedObjectType,
): ToastContent {
  const linkText = t('View in Recently Archived →');
  return {
    text: `${escape(text)} <a href="${escape(archiveHref(type))}">${escape(linkText)}</a>`,
    options: { allowHtml: true },
  };
}

/** An escaped archive toast with a collection link; hard-delete copy stays plain. */
export function deletedToastContent(
  name: string,
  type: ArchivedObjectType,
): ToastContent {
  const text = deletedToast(name);
  return isFeatureEnabled(FeatureFlag.SoftDelete)
    ? archiveToastContent(text, type)
    : { text };
}

/** Isolate the asset name so its direction cannot move translated punctuation. */
export function archiveTitle(name: string): ReactElement {
  const marker = '\uFFF0';
  const [before, after] = t('Archive %(name)s?', { name: marker }).split(
    marker,
  );
  return createElement(
    Fragment,
    null,
    before,
    createElement('bdi', { dir: 'auto' }, name),
    after,
  );
}

/** Explain dataset dependencies only when some dependent objects exist. */
export function datasetArchiveImpact(
  typeLabel: string,
  chartCount: number,
  dashboardCount: number,
  plural = false,
): string | null {
  if (chartCount === 0 && dashboardCount === 0) return null;
  const values = {
    type: typeLabel,
    charts: tn('%s chart', '%s charts', chartCount, chartCount),
    dashboards: tn(
      '%s dashboard',
      '%s dashboards',
      dashboardCount,
      dashboardCount,
    ),
  };
  if (dashboardCount === 0) {
    return plural
      ? t(
          'The selected %(type)s are used by %(charts)s. Archiving them will make dependent charts unavailable until they are recovered.',
          values,
        )
      : t(
          'This %(type)s is used by %(charts)s. Archiving it will make dependent charts unavailable until it is recovered.',
          values,
        );
  }
  return plural
    ? t(
        'The selected %(type)s are linked to %(charts)s on %(dashboards)s. Archiving them will make dependent charts unavailable until they are recovered.',
        values,
      )
    : t(
        'This %(type)s is linked to %(charts)s on %(dashboards)s. Archiving it will make dependent charts unavailable until it is recovered.',
        values,
      );
}

/*
 * The three below have no caller on `pr2/deferred-write` -- their consumers
 * are the asset list views, which that branch does not carry -- so they were
 * left off it rather than landing upstream as unused exports. They are used
 * here, by `ChartList`, `DashboardList`, `DatasetList` and `views/CRUD/utils`,
 * so they travel with those callers whenever those move.
 */
export function governedAcrossSelection(
  flags: (boolean | undefined)[],
): boolean | null {
  if (!flags.length) return deleteIsGoverned(undefined);
  const resolved = flags.map(flag => deleteIsGoverned(flag));
  const first = resolved[0];
  return resolved.every(flag => flag === first) ? first : null;
}
export function bulkArchiveConfirmDescription(typeLabel: string): string {
  // Nothing is archived by a mixed selection, so this must not say
  // otherwise. The gate captures the ones that need review and signals the
  // capture by raising, which aborts the whole bulk delete -- so the exempt
  // ones are not removed either. An earlier version of this sentence said
  // "some will be archived now", which the server cannot do: the exempt
  // dashboards stayed in the list with nothing on screen explaining why.
  //
  // No retention window is quoted for the same reason. Nothing reaches
  // Recently Archived here, so a recovery window would be describing a
  // place none of these assets is going.
  return t(
    'Only the %(type)s that need review are captured, and nothing is removed yet. The rest are left as they are; remove those on their own.',
    { type: typeLabel },
  );
}
export function deferredDeleteMessage(responseBody: unknown): string {
  const body = responseBody as { message?: string; count?: number } | null;
  if (body?.message) {
    return body.message;
  }
  // A captured delete is a draft, not a submission: no approver sees it
  // until the author requests review. Saying it was submitted described a
  // state it is not in (QA-05). The server says the same thing; this is
  // only the fallback for when it says nothing.
  return (body?.count ?? 1) > 1
    ? t(
        '%s deletes saved as drafts. Nothing has been removed. Request review on each when you are ready.',
        body?.count,
      )
    : t(
        'Delete saved as a draft. Nothing has been removed. Request review when you are ready.',
      );
}
