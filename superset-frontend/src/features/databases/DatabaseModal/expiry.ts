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
import { t, tn } from '@apache-superset/core/translation';
import { extendedDayjs } from '@superset-ui/core/utils/dates';
import { EncryptedExtraExpiration } from '../types';

// Warn this many calendar days before a stored token expires, so there is time
// to rotate it.
export const EXPIRY_WARNING_DAYS = 7;

/**
 * Calendar days from today to the day a token expires, in local time; NaN for
 * an invalid date.
 */
export const calendarDaysUntil = (expiresAt: string): number =>
  extendedDayjs(expiresAt)
    .startOf('day')
    .diff(extendedDayjs().startOf('day'), 'day');

/**
 * Whether a token expires today or within the warning window. A token whose day
 * the browser clock already passed counts too: the server decides whether it
 * has expired.
 */
export const isExpiringSoon = (expiresAt: string): boolean =>
  calendarDaysUntil(expiresAt) <= EXPIRY_WARNING_DAYS;

export type ExpiryLine = {
  path: string;
  label: string;
  text: string;
  expired: boolean;
  expiresAt: string;
};

// Expired, or expiring soon. A live token whose day the browser clock already
// passed reads as today.
const isListed = (expiresAt: string, expired: boolean) =>
  expired || isExpiringSoon(expiresAt);

const lineText = (label: string, expiresAt: string, expired: boolean) => {
  const expiry = extendedDayjs(expiresAt);
  if (expired) {
    return t('The stored %s expired on %s.', label, expiry.format('ll'));
  }
  const days = calendarDaysUntil(expiresAt);
  if (days <= 0) {
    return t('The stored %s expires today at %s.', label, expiry.format('LT'));
  }
  return tn(
    'The stored %s expires in %s day (%s).',
    'The stored %s expires in %s days (%s).',
    days,
    label,
    days,
    expiry.format('ll'),
  );
};

/**
 * One line per stored token that has expired or expires within the warning
 * window: expired first, then by expiry. Tokens sharing a label are told apart
 * by their path.
 */
export const expiryLines = (
  sensitiveFields: Record<string, string>,
  expirations: Record<string, EncryptedExtraExpiration>,
): ExpiryLine[] => {
  const listed = Object.entries(expirations)
    .map(([path, { expires_at: expiresAt, expired }]) => ({
      path,
      bareLabel: sensitiveFields[path] ?? path.replace(/^\$\./, ''),
      expired,
      expiresAt,
    }))
    .filter(({ expiresAt, expired }) => isListed(expiresAt, expired))
    .sort(
      (a, b) =>
        Number(b.expired) - Number(a.expired) ||
        Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
    );
  return listed.map(({ path, bareLabel, expired, expiresAt }) => {
    const shared =
      listed.filter(other => other.bareLabel === bareLabel).length > 1;
    const label = shared
      ? `${bareLabel} (${path.replace(/^\$\./, '')})`
      : bareLabel;
    return {
      path,
      label,
      text: lineText(label, expiresAt, expired),
      expired,
      expiresAt,
    };
  });
};
