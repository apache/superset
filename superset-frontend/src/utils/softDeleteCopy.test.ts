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
  deleteActionLabel,
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
