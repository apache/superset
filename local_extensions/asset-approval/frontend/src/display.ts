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
// Inlined rather than pulled from lodash: one call, and an extension pays
// for everything it bundles.
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    character =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[character] as string,
  );
// Not `@superset-ui/core/utils/dates`: Module Federation shares a module by
// its exact request, so a subpath of a shared package is not itself shared
// and would be bundled into this extension anyway. Imported directly, which
// is the same thing without the illusion of sharing.
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import utc from 'dayjs/plugin/utc';

dayjs.extend(relativeTime);
dayjs.extend(utc);
const extendedDayjs = dayjs;

import { translation } from '@apache-superset/core';

const { t } = translation;
import type {
  ChangeRequest,
  DatasetDetail,
  NamedDiff,
  UserBrief,
} from './types';
import { displayName } from './types';

/** Timestamps arrive as UTC ISO strings; render them in the reader's zone. */
export function toLocal(iso: string | null) {
  return iso ? extendedDayjs.utc(iso).local() : null;
}

/** "2 days ago", "a few seconds ago". */
export function ago(iso: string | null): string {
  const moment = toLocal(iso);
  return moment ? moment.fromNow() : '';
}

/** Bare age without the suffix, for "waiting 3 days". */
export function age(iso: string | null): string {
  const moment = toLocal(iso);
  return moment ? moment.fromNow(true) : '';
}

/**
 * A request waiting longer than this is drawn in amber (Visa Q8: requests
 * never expire, but a stale one should start to look stale).
 */
export const STALE_AFTER_DAYS = 3;

export function isStale(changeRequest: ChangeRequest): boolean {
  const submitted = toLocal(changeRequest.submitted_at);
  return (
    !!submitted && extendedDayjs().diff(submitted, 'day') >= STALE_AFTER_DAYS
  );
}

export function namesOf(users: UserBrief[] | undefined): string {
  if (!users || users.length === 0) return '';
  const names = users.map(displayName);
  if (names.length <= 2) return names.join(t(' and '));
  return t('%s and %s others', names[0], names.length - 1);
}

function namedCount(diff?: NamedDiff): number {
  return diff ? diff.added.length + diff.changed.length + diff.removed.length : 0;
}

/**
 * How many distinct things a dataset definition diff names.
 *
 * A dataset change carries nothing in `changes` -- the definition diff is
 * the change -- so a count that reads only `changes` reports zero for a
 * request that plainly renames a metric.
 */
export function datasetChangeCount(
  detail?: DatasetDetail | null,
): number {
  if (!detail) return 0;
  const sqlChanged =
    !!detail.sql && (detail.sql.before ?? '') !== (detail.sql.after ?? '');
  return (
    (sqlChanged ? 1 : 0) +
    namedCount(detail.columns) +
    namedCount(detail.metrics)
  );
}

/** Everything this request would change, whatever shape it arrived in. */
export function totalChangeCount(changeRequest: ChangeRequest): number {
  return (
    (changeRequest.changes ?? []).length +
    datasetChangeCount(changeRequest.dataset_detail)
  );
}

/** "3 changes" — the count the reviewer banner leads with.
 *
 * Counts what actually differs, not every key in the submitted payload. A
 * dashboard save resends the whole properties object, so the raw key count
 * said "10 changes" for a renamed title. Dataset definition changes are
 * counted too, so the panel cannot say "0 changes" above a listed one.
 */
export function changeCount(changeRequest: ChangeRequest): string {
  const n = totalChangeCount(changeRequest);
  return n === 1 ? t('1 change') : t('%s changes', n);
}

/**
 * Where the live asset lives.
 *
 * Shared so the Approvals list, the Home section and the reviewer's
 * "Open live version" link cannot drift to three different answers for
 * the same asset.
 */
export function assetUrl(changeRequest: ChangeRequest): string {
  if (changeRequest.asset_type === 'dashboard') {
    return `/superset/dashboard/${changeRequest.asset_id}/`;
  }
  if (changeRequest.asset_type === 'chart') {
    return `/explore/?slice_id=${changeRequest.asset_id}`;
  }
  return '/tablemodelview/list/';
}

/**
 * Toast content for a write that was captured for review rather than applied.
 *
 * Surfaces that have no review banner of their own (a modal over a list, for
 * one) would otherwise leave the author with no way to reach the request they
 * just created. The link carries the change request's id, which is the id
 * `/approvals/<id>/` expects.
 */
export function reviewRequiredToast(
  message: string | undefined,
  changeRequestId: number,
): { text: string; options: { allowHtml: boolean; duration: number } } {
  const text =
    message ?? t('Changes saved. Viewers still see the live version.');
  const linkText = t('Review changes');
  return {
    text: `${escape(text)} <a href="/approvals/${encodeURIComponent(
      String(changeRequestId),
    )}/">${escape(linkText)} →</a>`,
    options: { allowHtml: true, duration: 10000 },
  };
}
