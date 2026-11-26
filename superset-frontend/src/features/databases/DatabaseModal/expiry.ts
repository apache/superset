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
  // Whether the line is about a new, unsaved token in the editor.
  replaced: boolean;
  // `success` confirms a new token; the alert leaves it out.
  severity: 'error' | 'warning' | 'success';
};

// When the token now in the editor at each replaced stored path expires, or
// null when it has no readable expiry. Paths still holding the stored value are
// left out.
export type ReplacedTokens = Record<string, string | null>;

const BASE64URL = /^[A-Za-z0-9_-]*$/;
// 9999-12-31T23:59:59Z, the last second the server reads as an expiry.
const MAX_EXP = 253_402_300_799;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

// A JSON object from base64url, or undefined. Non-ASCII text decodes to Latin-1
// characters, which leaves the JSON structure and its numbers intact.
const decodeSegment = (
  segment: string,
): Record<string, unknown> | undefined => {
  try {
    const decoded: unknown = JSON.parse(
      atob(segment.replace(/-/g, '+').replace(/_/g, '/')),
    );
    return isRecord(decoded) ? decoded : undefined;
  } catch {
    return undefined;
  }
};

/**
 * When a JWT expires, as an ISO string, from its unverified `exp` claim.
 * Follows the server's checks on the three segments and on `exp`; PyJWT's
 * header checks (`kid`, `crit`, `b64`) are not repeated. Undefined for
 * anything else.
 * Runs in the browser only, so a pasted token never leaves the editor.
 */
export const jwtExpiresAt = (value: string): string | undefined => {
  const parts = value.trim().split('.');
  if (
    parts.length !== 3 ||
    !parts[0] ||
    !parts[1] ||
    !parts.every(part => BASE64URL.test(part)) ||
    !decodeSegment(parts[0])
  ) {
    return undefined;
  }
  const exp = decodeSegment(parts[1])?.exp;
  if (typeof exp !== 'number' || !Number.isFinite(exp)) {
    return undefined;
  }
  if (exp < 0 || exp > MAX_EXP) {
    return undefined;
  }
  return new Date(exp * 1000).toISOString();
};

// The value at a dotted path such as `$.connect_args.jwt`.
const valueAt = (payload: unknown, path: string): unknown =>
  path
    .split('.')
    .slice(1)
    .reduce<unknown>(
      (value, key) => (isRecord(value) ? value[key] : undefined),
      payload,
    );

/**
 * The stored paths whose value in the editor's Secure extra differs from the
 * masked value the server sent, with the new token's expiry. Undefined while
 * the editor's JSON does not parse; empty without the server's JSON.
 */
export const replacedTokens = (
  storedSecureExtra: string | undefined,
  secureExtra: string | undefined,
  paths: string[],
): ReplacedTokens | undefined => {
  if (!storedSecureExtra) {
    return {};
  }
  let current: unknown;
  let stored: unknown;
  try {
    current = JSON.parse(secureExtra ?? '');
  } catch {
    return undefined;
  }
  try {
    stored = JSON.parse(storedSecureExtra);
  } catch {
    return {};
  }
  return Object.fromEntries(
    paths.flatMap(path => {
      const value = valueAt(current, path);
      if (value === valueAt(stored, path)) {
        return [];
      }
      return [
        [
          path,
          typeof value === 'string' ? (jwtExpiresAt(value) ?? null) : null,
        ],
      ];
    }),
  );
};

// Expired, or expiring soon. A live token whose day the browser clock already
// passed reads as today.
const isListed = (expiresAt: string, expired: boolean) =>
  expired || isExpiringSoon(expiresAt);

// A new token in the editor that expires after the warning window.
const confirmationText = (label: string, expiresAt: string) =>
  t(
    'The new %s expires on %s. Click Finish to save it.',
    label,
    extendedDayjs(expiresAt).format('ll'),
  );

// A new token in the editor that expired or expires soon.
const newLineText = (label: string, expiresAt: string, expired: boolean) => {
  const expiry = extendedDayjs(expiresAt);
  if (expired) {
    return t('The new, unsaved %s expired on %s.', label, expiry.format('ll'));
  }
  const days = calendarDaysUntil(expiresAt);
  if (days <= 0) {
    return t(
      'The new, unsaved %s expires today at %s.',
      label,
      expiry.format('LT'),
    );
  }
  return tn(
    'The new, unsaved %s expires in %s day (%s).',
    'The new, unsaved %s expires in %s days (%s).',
    days,
    label,
    days,
    expiry.format('ll'),
  );
};

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
 * window: expired first, then by expiry. A token whose label another declared
 * field shares is told apart by its path. A stored token replaced in the editor
 * gives a line about the new token instead, or none when the new value has no
 * readable expiry.
 */
export const expiryLines = (
  sensitiveFields: Record<string, string>,
  expirations: Record<string, EncryptedExtraExpiration>,
  replaced: ReplacedTokens = {},
): ExpiryLine[] => {
  const listed = Object.entries(expirations)
    .flatMap(([path, stored]) => {
      const isReplaced = path in replaced;
      const newExpiresAt = replaced[path];
      if (isReplaced && !newExpiresAt) {
        return [];
      }
      const expiresAt = newExpiresAt ?? stored.expires_at;
      return [
        {
          path,
          bareLabel: sensitiveFields[path] ?? path.replace(/^\$\./, ''),
          // The server decides for a stored token, the browser for a new one.
          expired: newExpiresAt
            ? Date.parse(newExpiresAt) <= Date.now()
            : stored.expired,
          expiresAt,
          replaced: isReplaced,
        },
      ];
    })
    .filter(
      ({ expiresAt, expired, replaced: isNew }) =>
        isNew || isListed(expiresAt, expired),
    )
    .sort(
      (a, b) =>
        Number(b.expired) - Number(a.expired) ||
        Date.parse(a.expiresAt) - Date.parse(b.expiresAt),
    );
  return listed.map(
    ({ path, bareLabel, expired, expiresAt, replaced: isNew }) => {
      const shared =
        Object.values(sensitiveFields).filter(other => other === bareLabel)
          .length > 1;
      const label = shared
        ? `${bareLabel} (${path.replace(/^\$\./, '')})`
        : bareLabel;
      const warned = isListed(expiresAt, expired);
      let text = lineText(label, expiresAt, expired);
      if (isNew) {
        text = warned
          ? newLineText(label, expiresAt, expired)
          : confirmationText(label, expiresAt);
      }
      let severity: ExpiryLine['severity'] = 'success';
      if (expired) {
        severity = 'error';
      } else if (warned) {
        severity = 'warning';
      }
      return {
        path,
        label,
        text,
        expired,
        expiresAt,
        replaced: isNew,
        severity,
      };
    },
  );
};
