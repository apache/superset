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
  archiveConfirmContent,
  deletedToastContent,
  datasetArchiveImpact,
  getSoftDeleteRetentionDays,
  recoveredToast,
} from './softDeleteCopy';
import { isFeatureEnabled } from '@superset-ui/core';
import { render, screen } from 'spec/helpers/testing-library';
import getBootstrapData, { applicationRoot } from 'src/utils/getBootstrapData';

jest.mock('@superset-ui/core', () => ({
  ...jest.requireActual('@superset-ui/core'),
  isFeatureEnabled: jest.fn(),
}));

jest.mock('src/utils/getBootstrapData', () => ({
  __esModule: true,
  applicationRoot: jest.fn(() => ''),
  default: jest.fn(() => ({ common: { conf: {} } })),
}));

const mockBootstrapData = getBootstrapData as jest.Mock;

/** Set what the server put in `common.conf` for this test. */
const withConf = (conf: Record<string, unknown>) =>
  mockBootstrapData.mockReturnValue({ common: { conf } });

beforeEach(() => {
  withConf({});
  (applicationRoot as jest.Mock).mockReturnValue('');
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
    'This chart will be moved to Recently Archived. You can recover it there within 30 days.',
  );
  expect(archiveConfirmDescription('charts', true)).toBe(
    'These charts will be moved to Recently Archived. You can recover them there within 30 days.',
  );
});

test('a one-day window is quoted in the singular', () => {
  withConf({ SOFT_DELETE_RETENTION_DAYS: 1 });
  expect(archiveConfirmDescription('chart')).toBe(
    'This chart will be moved to Recently Archived. You can recover it there within 1 day.',
  );
  expect(archiveConfirmDescription('charts', true)).toBe(
    'These charts will be moved to Recently Archived. You can recover them there within 1 day.',
  );
});

test('the confirm copy omits the clause when there is no window', () => {
  withConf({});
  expect(archiveConfirmDescription('dashboard')).toBe(
    'This dashboard will be moved to Recently Archived. You can recover it there.',
  );
  expect(archiveConfirmDescription('dashboards', true)).toBe(
    'These dashboards will be moved to Recently Archived. You can recover them there.',
  );
});

test.each(['', '/superset'])(
  'archive confirmation stays in the dialog under app root %s',
  root => {
    (applicationRoot as jest.Mock).mockReturnValue(root);
    const { container } = render(
      archiveConfirmContent('dashboard', 'dashboard'),
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(container).toHaveTextContent(
      'This dashboard will be moved to Recently Archived. You can recover it there.',
    );
    expect(container.textContent?.match(/Recently Archived/g)).toHaveLength(1);
  },
);

test('archive toast escapes names and links to its collection', () => {
  const spy = isFeatureEnabled as jest.Mock;
  spy.mockReturnValue(true);
  const toast = deletedToastContent('<img src=x onerror=alert(1)>', 'dataset');
  expect(toast.text).not.toContain('<img');
  expect(toast.text).toContain('&lt;img');
  expect(toast.text).toContain('href="/archived/?type=dataset"');
  expect(toast.options).toEqual({ allowHtml: true });
  spy.mockReturnValue(false);
  expect(deletedToastContent('name', 'chart')).toEqual({
    text: 'Deleted: name',
  });
  spy.mockReset();
});

test('archive toast preserves and escapes the application root', () => {
  (applicationRoot as jest.Mock).mockReturnValue('/superset&qa');
  (isFeatureEnabled as jest.Mock).mockReturnValue(true);
  expect(deletedToastContent('name', 'dataset').text).toContain(
    'href="/superset&amp;qa/archived/?type=dataset"',
  );
});

test.each([1, 2])(
  'dataset impact omits absent dashboards for %s charts',
  count => {
    const charts = count === 1 ? '1 chart' : '2 charts';
    expect(datasetArchiveImpact('dataset', count, 0)).toBe(
      `This dataset is used by ${charts}. Archiving it will make dependent charts unavailable until it is recovered.`,
    );
    expect(datasetArchiveImpact('datasets', count, 0, true)).toBe(
      `The selected datasets are used by ${charts}. Archiving them will make dependent charts unavailable until they are recovered.`,
    );
  },
);

test('dataset impact omits empty dependencies and retains nonzero dashboard counts', () => {
  expect(datasetArchiveImpact('dataset', 0, 0)).toBeNull();
  expect(datasetArchiveImpact('dataset', 2, 1)).toContain(
    'linked to 2 charts on 1 dashboard',
  );
});
