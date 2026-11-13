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
  getNotificationMethodOptions,
  supportsTeamsRecipients,
} from './notificationMethods';
import {
  NotificationMethodOption as Method,
  NotificationSetting,
} from './types';

const settings: NotificationSetting[] = [
  { method: Method.Email, recipients: 'owner@example.com', options: [] },
  { method: Method.Teams, recipients: 'ops', options: [] },
  { method: Method.Teams, recipients: 'finance', options: [] },
];

test('multiple Teams destinations keep Teams available for another recipient entry', () => {
  expect(
    getNotificationMethodOptions([Method.Email, Method.Teams], settings),
  ).toEqual([Method.Teams]);
  expect(settings.map(item => item.recipients)).toEqual([
    'owner@example.com',
    'ops',
    'finance',
  ]);
});

test('editing preserves a saved Teams method when deployment configuration changes', () => {
  expect(getNotificationMethodOptions([Method.Email], settings, 1)).toEqual([
    Method.Teams,
  ]);
  expect(getNotificationMethodOptions([Method.Email], settings)).toEqual([]);
});

test('Slack variants share one method slot while the selected method remains visible', () => {
  const slack = [{ method: Method.SlackV2, recipients: 'C123', options: [] }];
  expect(
    getNotificationMethodOptions(
      [Method.Email, Method.Slack, Method.SlackV2, Method.Teams],
      slack,
    ),
  ).toEqual([Method.Email, Method.Teams]);
  expect(
    getNotificationMethodOptions([Method.Slack, Method.SlackV2], slack, 0),
  ).toContain(Method.SlackV2);
});

test.each([
  [false, true, 'NONE', true],
  [false, true, 'PNG', false],
  [false, true, 'CSV', false],
  [false, false, 'PNG', true],
  [true, false, 'NONE', false],
  [true, true, 'NONE', false],
])(
  'Teams eligibility: report=%s attachments=%s format=%s',
  (isReport, attachmentsEnabled, format, expected) => {
    expect(supportsTeamsRecipients(isReport, attachmentsEnabled, format)).toBe(
      expected,
    );
  },
);
