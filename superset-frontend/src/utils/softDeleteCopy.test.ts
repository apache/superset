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
import {
  archiveConfirmDescription,
  bulkArchiveConfirmDescription,
  deleteActionLabel,
  deleteConfirmLabel,
  governedAcrossSelection,
  deleteReviewMessage,
  getSoftDeleteRetentionDays,
  recoveredToast,
} from './softDeleteCopy';
import getBootstrapData from 'src/utils/getBootstrapData';
import { FeatureFlag } from '@superset-ui/core';

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  default: jest.fn(() => ({ common: { conf: {} } })),
}));

const mockBootstrapData = getBootstrapData as jest.Mock;

/** Set what the server put in `common.conf` for this test. */
const withConf = (conf: Record<string, unknown>) =>
  mockBootstrapData.mockReturnValue({ common: { conf } });

beforeEach(() => {
  withConf({});
  window.featureFlags = {};
});

test('recoveredToast links to the asset and enables HTML when a url is present', () => {
  const { text, options } = recoveredToast(
    'My Chart',
    'Chart',
    '/explore/?slice_id=1',
  );
  expect(text).toContain('My Chart restored successfully');
  expect(text).toContain('<a href="/explore/?slice_id=1">');
  expect(text).toContain('View Chart');
  expect(options).toEqual({ allowHtml: true });
});

test('recoveredToast is plain text with no html when there is no url', () => {
  const { text, options } = recoveredToast('My Chart', 'Chart');
  expect(text).toBe('My Chart restored successfully');
  expect(options).toBeUndefined();
});

test('recoveredToast escapes HTML in the asset name', () => {
  const { text } = recoveredToast('<b>x</b>', 'Chart', '/u');
  expect(text).toContain('&lt;b&gt;x&lt;/b&gt;');
  expect(text).not.toContain('<b>x</b>');
});

/**
 * The retention window the server resolved. These were the untested branches
 * that let a wrong bootstrap key ship: the copy silently lost its time bound
 * everywhere, and nothing failed.
 */

test('the resolved retention window is read from the bootstrap payload', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 7 });
  expect(getSoftDeleteRetentionDays()).toBe(7);
});

test('a window absent from the payload reads as no time bound', () => {
  // The key is omitted entirely when the SOFT_DELETE feature is off.
  withConf({});
  expect(getSoftDeleteRetentionDays()).toBe(0);
});

test('a disabled window (0) reads as no time bound rather than zero days', () => {
  // 0 means retention is switched off, so objects are kept indefinitely --
  // recoverable, just with no deadline to quote.
  withConf({ SOFT_DELETE_RETENTION_DAYS: 0 });
  expect(getSoftDeleteRetentionDays()).toBe(0);
});

test('a malformed window does not leak into the copy', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 'not a number' });
  expect(getSoftDeleteRetentionDays()).toBe(0);
  withConf({ SOFT_DELETE_RETENTION_DAYS: -5 });
  expect(getSoftDeleteRetentionDays()).toBe(0);
});

test('immediate eligibility does not promise a recovery window', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: -1 });
  expect(getSoftDeleteRetentionDays()).toBe(-1);
  expect(archiveConfirmDescription('chart')).toBe(
    'This chart will be moved to Recently Archived and may be permanently deleted on the next cleanup run.',
  );
  expect(archiveConfirmDescription('charts', true)).toBe(
    'These charts will be moved to Recently Archived and may be permanently deleted on the next cleanup run.',
  );
});

test('the confirm copy quotes the window when there is one', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 30 });
  expect(archiveConfirmDescription('chart')).toBe(
    'This chart will be moved to Recently Archived in the Settings menu. You can recover it there within 30 days.',
  );
  expect(archiveConfirmDescription('charts', true)).toBe(
    'These charts will be moved to Recently Archived in the Settings menu. You can recover them there within 30 days.',
  );
});

test('a one-day window is quoted in the singular', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 1 });
  expect(archiveConfirmDescription('chart')).toBe(
    'This chart will be moved to Recently Archived in the Settings menu. You can recover it there within 1 day.',
  );
  expect(archiveConfirmDescription('charts', true)).toBe(
    'These charts will be moved to Recently Archived in the Settings menu. You can recover them there within 1 day.',
  );
});

test('the confirm copy omits the clause when there is no window', () => {
  withConf({});
  expect(archiveConfirmDescription('dashboard')).toBe(
    'This dashboard will be moved to Recently Archived in the Settings menu. You can recover it there.',
  );
  expect(archiveConfirmDescription('dashboards', true)).toBe(
    'These dashboards will be moved to Recently Archived in the Settings menu. You can recover them there.',
  );
});

test('deleteReviewMessage is null for a delete that actually happened', () => {
  expect(deleteReviewMessage(undefined)).toBeNull();
  expect(deleteReviewMessage({})).toBeNull();
  expect(deleteReviewMessage({ message: 'ok' })).toBeNull();
});

test('deleteReviewMessage returns the server message for a gated delete', () => {
  expect(
    deleteReviewMessage({
      id: 1,
      review_required: true,
      message: 'Delete submitted for review. Nothing has been removed.',
    }),
  ).toBe('Delete submitted for review. Nothing has been removed.');
});

test('deleteReviewMessage falls back to copy that says nothing was removed', () => {
  expect(deleteReviewMessage({ id: 1, review_required: true })).toBe(
    'Delete saved as a draft. Nothing has been removed. Request review when you are ready.',
  );
  expect(deleteReviewMessage({ id: 1, count: 3, review_required: true })).toBe(
    '3 deletes saved as drafts. Nothing has been removed. Request review on each when you are ready.',
  );
});

test('the fallback does not claim a draft was submitted', () => {
  // QA-05: the delete lands as a DRAFT that no approver sees until the
  // author requests review, so neither branch may say "submitted".
  expect(deleteReviewMessage({ id: 1, review_required: true })).not.toMatch(
    /submitted/i,
  );
  expect(
    deleteReviewMessage({ id: 1, count: 3, review_required: true }),
  ).not.toMatch(/submitted/i);
});


// ---- the confirmation has to describe what pressing it does ----------------

test('with review on, the dialog does not promise an archive it will not make', () => {
  // The delete is captured as a draft and the asset stays where it is, so
  // "will be moved to Recently Archived" described an outcome that does
  // not happen -- and the toast that follows then said the opposite.
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  const copy = archiveConfirmDescription('chart');

  expect(copy).toContain('needs review');
  expect(copy).toContain('Nothing is removed yet');
  expect(copy).not.toContain('Recently Archived');
});

test('and it says so for a bulk delete too', () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  const copy = archiveConfirmDescription('charts', true);

  expect(copy).toContain('These charts need review');
  expect(copy).not.toContain('Recently Archived');
});

test('with review off, the archive copy is exactly as it was', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 30 });

  const copy = archiveConfirmDescription('chart');

  expect(copy).toContain('Recently Archived');
  expect(copy).toContain('30 days');
});

test('the verb matches what pressing it does', () => {
  // The dialog said "Archive <name>?" with an "Archive" button over a body
  // explaining the asset needs review before it is removed. Nothing is
  // archived and nothing is removed: a draft is filed.
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
  expect(deleteActionLabel()).toBe('Request removal');

  window.featureFlags = { [FeatureFlag.SoftDelete]: true };
  expect(deleteActionLabel()).toBe('Archive');

  window.featureFlags = {};
  expect(deleteActionLabel()).toBe('Delete');
});

// ---- B1: review being on is not the same as this delete being governed -----

test('an exempt dashboard is not promised a review that will not happen', () => {
  // SOW 5.1: a dashboard that has never been published is removed at once.
  // The dialog said "This dashboard needs review before it is removed.
  // Nothing is removed yet" over that delete, word for word the same
  // sentence it says over the case that really is held.
  withConf({ SOFT_DELETE_RETENTION_DAYS: 30 });
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  const copy = archiveConfirmDescription('dashboard', false, false);

  expect(copy).toContain('Recently Archived');
  expect(copy).toContain('30 days');
  expect(copy).not.toContain('needs review');
});

test('and a governed one still is', () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  // Asserted whole, not by substring. The clause that matters most is the
  // last one: "viewers keep seeing it until a reviewer approves" is the
  // promise the gate actually makes, and a sentence saying the opposite --
  // "viewers can no longer see it" -- still contains "needs review" and
  // still passes a `toContain`. That is how a governed dialog could come to
  // describe the ungoverned outcome without a test noticing.
  expect(archiveConfirmDescription('dashboard', false, true)).toBe(
    'This dashboard needs review before it is removed. Nothing is removed yet, and viewers keep seeing it until a reviewer approves.',
  );
  expect(archiveConfirmDescription('dashboards', true, true)).toBe(
    'These dashboards need review before they are removed. Nothing is removed yet, and viewers keep seeing them until a reviewer approves.',
  );
});

test('the button on an exempt dashboard names what it does', () => {
  // "Request removal" over a control that removes the thing was the label
  // half of the same defect. A label cannot hedge, so it is told.
  window.featureFlags = {
    [FeatureFlag.ChangeManagement]: true,
    [FeatureFlag.SoftDelete]: true,
  };

  expect(deleteActionLabel(false)).toBe('Archive');
  expect(deleteActionLabel(true)).toBe('Request removal');
});

test('an unanswered asset reads as the flag did before', () => {
  // Charts and datasets have no exemption, so they pass nothing and must
  // keep the review wording; it is also the moment before the lookup lands.
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  expect(archiveConfirmDescription('chart')).toContain('needs review');
  expect(archiveConfirmDescription('chart', false, undefined)).toContain(
    'needs review',
  );
  expect(deleteActionLabel(undefined)).toBe('Request removal');
});

test('with review off, being told nothing is governed changes nothing', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 30 });

  expect(archiveConfirmDescription('dashboard', false, false)).toContain(
    'Recently Archived',
  );
});

// ---- a selection that does not all end the same way ------------------------

test('a selection that agrees answers with that answer', () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  expect(governedAcrossSelection([true, true])).toBe(true);
  expect(governedAcrossSelection([false, false])).toBe(false);
});

test('a selection that disagrees answers null rather than picking a side', () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };

  expect(governedAcrossSelection([true, false])).toBeNull();
});

test('unanswered ids in a selection are read through the flag', () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
  expect(governedAcrossSelection([undefined, true])).toBe(true);
  expect(governedAcrossSelection([undefined, false])).toBeNull();

  window.featureFlags = {};
  expect(governedAcrossSelection([undefined, false])).toBe(false);
});

test('an empty selection falls back to the flag', () => {
  window.featureFlags = { [FeatureFlag.ChangeManagement]: true };
  expect(governedAcrossSelection([])).toBe(true);
});

test('the mixed sentence does not promise an archive the server cannot make', () => {
  // This said "some will be archived now", and nothing is archived: the
  // gate signals a capture by raising, which aborts the whole bulk delete,
  // so the exempt members are not removed either. They stayed in the list
  // with nothing on screen explaining why.
  const copy = bulkArchiveConfirmDescription('dashboards');

  expect(copy).toBe(
    'Only the dashboards that need review are captured, and nothing is removed yet. The rest are left as they are; remove those on their own.',
  );
  expect(copy).not.toContain('archived now');
});

test('and quotes no recovery window, because nothing reaches the archive', () => {
  // A retention window here would be describing a place none of these
  // assets is going.
  withConf({ SOFT_DELETE_RETENTION_DAYS: 30 });

  const copy = bulkArchiveConfirmDescription('dashboards');

  expect(copy).not.toContain('30 days');
  expect(copy).not.toContain('Recently Archived');
});

test('nor at immediate eligibility, where it never did reach one', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: -1 });

  expect(bulkArchiveConfirmDescription('dashboards')).not.toContain(
    'cleanup run',
  );
});

// ---- the button is what gets pressed ---------------------------------------

test('the confirm button names the act, not the archive it is not making', () => {
  // The modal's own default for a recoverable delete is "Archive", and no
  // dashboard surface overrode it -- so every governed delete offered an
  // "Archive" button under a body reading "needs review before it is
  // removed. Nothing is removed yet."
  window.featureFlags = {
    [FeatureFlag.ChangeManagement]: true,
    [FeatureFlag.SoftDelete]: true,
  };

  expect(deleteConfirmLabel(true)).toBe('Request removal');
  expect(deleteConfirmLabel(false)).toBe('Archive');
});

test('and falls back to the flag for an asset with no exemption', () => {
  // Charts and datasets pass nothing, because review being on is their
  // whole answer.
  window.featureFlags = {
    [FeatureFlag.ChangeManagement]: true,
    [FeatureFlag.SoftDelete]: true,
  };
  expect(deleteConfirmLabel()).toBe('Request removal');

  window.featureFlags = { [FeatureFlag.SoftDelete]: true };
  expect(deleteConfirmLabel()).toBe('Archive');

  window.featureFlags = {};
  expect(deleteConfirmLabel()).toBe('Delete');
});
