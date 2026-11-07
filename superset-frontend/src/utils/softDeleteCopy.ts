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
import { t, tn } from '@apache-superset/core/translation';
import { isFeatureEnabled, FeatureFlag } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';
import { isReviewRequired } from 'src/features/changeManagement/types';

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
 * Whether review governs this delete, resolving "not been told" to the flag.
 *
 * Exported because a dialog's *title* has to agree with its body, and the
 * title is written by the call site: "Archive X?" over a sentence saying it
 * needs review first was the first half of B1.
 *
 * Charts and datasets have no exemption -- `_gate_chart_delete` and
 * `_gate_dataset_delete` hand every delete to the gate -- so the flag is
 * their whole answer and they pass nothing. For a dashboard it is the
 * answer only until `useGovernedDeletes` comes back, and it is the wording
 * that was here before any of this: review on, review promised.
 */
export function deleteIsGoverned(governed?: boolean): boolean {
  return governed ?? isFeatureEnabled(FeatureFlag.ChangeManagement);
}

/**
 * Body copy for a recoverable (soft-delete) delete confirmation. `typeLabel`
 * is the lowercase noun for the object(s), e.g. "chart" or "charts". When the
 * retention window is disabled (0), the time-bound clause is omitted.
 *
 * `governed` says whether this delete is actually held for review. It has to
 * be passed for dashboards, where SOW 5.1 exempts one that has never been
 * published: that delete applies at once, and this dialog used to promise a
 * review for it anyway (B1). See `useGovernedDeletes`.
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
    // With review on, pressing this archives nothing. The delete is
    // captured as a draft and the asset stays exactly where it is until
    // somebody approves it, so a dialog promising Recently Archived
    // describes an outcome that will not happen -- and the toast that
    // follows (`deleteReviewMessage`) then contradicts it.
    //
    // The converse is the defect this `governed` argument exists for: said
    // over an exempt dashboard, these sentences promise a review that will
    // not happen and a row that is about to be gone.
    //
    // Said without a day count or a recovery route, because neither
    // applies yet: both belong to the archive this has not reached.
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
          'These %(type)s will be moved to Recently Archived in the Settings menu. You can recover them there within %(days)s day.',
          'These %(type)s will be moved to Recently Archived in the Settings menu. You can recover them there within %(days)s days.',
          days,
          { type: typeLabel, days },
        )
      : tn(
          'This %(type)s will be moved to Recently Archived in the Settings menu. You can recover it there within %(days)s day.',
          'This %(type)s will be moved to Recently Archived in the Settings menu. You can recover it there within %(days)s days.',
          days,
          { type: typeLabel, days },
        );
  }
  return plural
    ? t(
        'These %(type)s will be moved to Recently Archived in the Settings menu. You can recover them there.',
        { type: typeLabel },
      )
    : t(
        'This %(type)s will be moved to Recently Archived in the Settings menu. You can recover it there.',
        { type: typeLabel },
      );
}

/**
 * The label on the confirm button of a delete dialog.
 *
 * Separate from `deleteActionLabel`, which names the *control that opens*
 * the dialog. This one names the act about to happen when it is pressed,
 * and it is the thing the person actually clicks.
 *
 * It needed saying because the modal's own default for a recoverable delete
 * is "Archive", and no dashboard surface overrode it -- so every governed
 * delete, including a mixed bulk where nothing at all is archived, offered
 * an "Archive" button under a body reading "needs review before it is
 * removed. Nothing is removed yet."
 */
export function deleteConfirmLabel(governed?: boolean): string {
  if (deleteIsGoverned(governed)) {
    return t('Request removal');
  }
  return isFeatureEnabled(FeatureFlag.SoftDelete) ? t('Archive') : t('Delete');
}

/**
 * One answer for a whole selection, or `null` when they disagree.
 *
 * A bulk delete can hold a published dashboard and a private draft at once,
 * and the two halves end differently: one is filed for review, the other is
 * archived. `null` says so, and `bulkArchiveConfirmDescription` is the
 * sentence for it. Unanswered ids are read the way a single one is, through
 * the flag, so a selection nothing is known about reads as it did before.
 */
export function governedAcrossSelection(
  flags: (boolean | undefined)[],
): boolean | null {
  if (!flags.length) return deleteIsGoverned(undefined);
  const resolved = flags.map(flag => deleteIsGoverned(flag));
  const first = resolved[0];
  return resolved.every(flag => flag === first) ? first : null;
}

/**
 * Body copy for a bulk delete whose assets do not all end the same way.
 *
 * Said rather than picked, because picking either sentence makes the dialog
 * wrong about half the selection -- which is B1 again, one row along.
 */
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

/**
 * Label for the delete affordance on list rows and bulk actions: "Archive"
 * when soft-delete is on (the action is recoverable), "Delete" when it is
 * off. One home for the vocabulary fork so a rename lands once.
 */
export function deleteActionLabel(governed?: boolean): string {
  // With review on, pressing this archives nothing and deletes nothing: it
  // files a draft that a second person has to approve. "Archive" named an
  // outcome that does not happen, and sat on the same dialog as a body
  // saying the asset needs review before it is removed -- the title
  // promising one thing and the sentence under it another.
  //
  // `governed` for the same reason the description takes it: on an exempt
  // dashboard this control does remove the thing, and calling it "Request
  // removal" was the label half of B1. A label cannot hedge, so it has to
  // be told.
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
 * The message to show when a delete was captured for review instead of
 * applied (the server answers 202 with `review_required`), or `null` when the
 * delete really happened. Callers use the `null` to keep their normal path:
 * the "Archived: <name>" toast and the list refresh are both wrong for a
 * delete that removed nothing.
 */
export function deleteReviewMessage(responseBody: unknown): string | null {
  if (!isReviewRequired(responseBody)) {
    return null;
  }
  if (responseBody.message) {
    return responseBody.message;
  }
  // A captured delete is a draft, not a submission: no approver sees it
  // until the author requests review. Saying it was submitted described a
  // state it is not in (QA-05). The server says the same thing; this is
  // only the fallback for when it says nothing.
  return (responseBody.count ?? 1) > 1
    ? t(
        '%s deletes saved as drafts. Nothing has been removed. Request review on each when you are ready.',
        responseBody.count,
      )
    : t(
        'Delete saved as a draft. Nothing has been removed. Request review when you are ready.',
      );
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
