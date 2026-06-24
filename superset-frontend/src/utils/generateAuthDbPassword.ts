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
import { t } from '@apache-superset/core/translation';
/**
 * Client-side generator aligned with default ``AUTH_DB_CONFIG`` / Python
 * ``superset.utils.auth_db_password`` (minimum length, character classes, common list).
 * Keep ``AUTH_DB_COMMON_PASSWORDS`` in sync with ``_COMMON_PASSWORDS`` in that module.
 */
export const AUTH_DB_PASSWORD_MIN_LENGTH = 12;
export interface AuthDbPasswordPolicy {
  password_min_length: number;
  password_require_uppercase: boolean;
  password_require_lowercase: boolean;
  password_require_digit: boolean;
  password_require_special: boolean;
  password_common_list_check: boolean;
}

export const AUTH_DB_DEFAULT_PASSWORD_POLICY: AuthDbPasswordPolicy = {
  password_min_length: AUTH_DB_PASSWORD_MIN_LENGTH,
  password_require_uppercase: true,
  password_require_lowercase: true,
  password_require_digit: true,
  password_require_special: true,
  password_common_list_check: true,
};

/**
 * Lowercased entries; keep in sync with ``_COMMON_PASSWORDS`` in
 * ``superset/utils/auth_db_password.py``. The sync is enforced automatically by
 * ``generateAuthDbPassword.test.ts``, which parses the Python source.
 */
export const AUTH_DB_COMMON_PASSWORDS = new Set(
  [
    'password',
    'password1',
    'password123',
    '123456',
    '12345678',
    '123456789',
    'qwerty',
    'abc123',
    'monkey',
    'letmein',
    'trustno1',
    'dragon',
    'baseball',
    'iloveyou',
    'master',
    'sunshine',
    'ashley',
    'bailey',
    'shadow',
    'superman',
    'qazwsx',
    'michael',
    'football',
    'welcome',
    'jesus',
    'ninja',
    'mustang',
    'password1!',
    'admin',
    'admin123',
    'root',
    'toor',
    'guest',
    'p@ssw0rd',
    'Passw0rd',
    'Password1',
    'Password123',
    'Welcome1',
    'Qwerty123',
  ].map(s => s.toLowerCase()),
);

const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
const LOWER = 'abcdefghijkmnopqrstuvwxyz';
const DIGIT = '23456789';
const SPECIAL = '!@#$%^&*-_=+';
const ALPHANUM = UPPER + LOWER + DIGIT;

export interface AuthDbPasswordPolicyChecks {
  minLength: boolean;
  uppercase: boolean;
  lowercase: boolean;
  digit: boolean;
  special: boolean;
  commonPassword: boolean;
}

function getCodePointLength(text: string): number {
  return Array.from(text).length;
}

/** Mirrors ``int(cfg.get("password_min_length", default))`` in auth_db_password.py. */
function resolveAuthDbPasswordMinLength(
  passwordMinLength: number | undefined | null,
): number {
  if (passwordMinLength === undefined || passwordMinLength === null) {
    return AUTH_DB_PASSWORD_MIN_LENGTH;
  }
  const parsed = Number(passwordMinLength);
  if (!Number.isFinite(parsed)) {
    return AUTH_DB_PASSWORD_MIN_LENGTH;
  }
  return Math.trunc(parsed);
}

function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 0) {
    throw new Error('secureRandomInt: maxExclusive must be positive');
  }
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues) {
    throw new Error(
      'secureRandomInt: a Web Crypto implementation with getRandomValues ' +
        'is required to generate passwords',
    );
  }
  const maxUint32 = 0xffffffff;
  const limit = maxUint32 - (maxUint32 % maxExclusive);
  const buf = new Uint32Array(1);
  let value: number;
  do {
    cryptoObj.getRandomValues(buf);
    value = buf[0]!;
  } while (value >= limit);
  return value % maxExclusive;
}

function pick(pool: string): string {
  return pool[secureRandomInt(pool.length)]!;
}

function shuffleInPlace(chars: string[]): void {
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = secureRandomInt(i + 1);
    const t = chars[i]!;
    chars[i] = chars[j]!;
    chars[j] = t;
  }
}

function getRequiredCharacterPools(policy: AuthDbPasswordPolicy): string[] {
  const pools: string[] = [];
  if (policy.password_require_uppercase) {
    pools.push(UPPER);
  }
  if (policy.password_require_lowercase) {
    pools.push(LOWER);
  }
  if (policy.password_require_digit) {
    pools.push(DIGIT);
  }
  if (policy.password_require_special) {
    pools.push(SPECIAL);
  }
  return pools;
}

function getGenerationPool(policy: AuthDbPasswordPolicy): string {
  let pool = '';
  if (policy.password_require_uppercase) {
    pool += UPPER;
  }
  if (policy.password_require_lowercase) {
    pool += LOWER;
  }
  if (policy.password_require_digit) {
    pool += DIGIT;
  }
  if (policy.password_require_special) {
    pool += SPECIAL;
  }
  return pool || ALPHANUM + SPECIAL;
}

/** Returns rule-by-rule checks for default AUTH_DB password policy. */
export function getAuthDbPasswordPolicyChecks(
  password: string,
  policy: AuthDbPasswordPolicy = AUTH_DB_DEFAULT_PASSWORD_POLICY,
): AuthDbPasswordPolicyChecks {
  const minLength = resolveAuthDbPasswordMinLength(policy.password_min_length);
  return {
    minLength: getCodePointLength(password) >= minLength,
    uppercase: !policy.password_require_uppercase || /[A-Z]/.test(password),
    lowercase: !policy.password_require_lowercase || /[a-z]/.test(password),
    digit: !policy.password_require_digit || /\p{Nd}/u.test(password),
    special:
      !policy.password_require_special || /[^\p{L}\p{N}\s]/u.test(password),
    commonPassword:
      !policy.password_common_list_check ||
      !AUTH_DB_COMMON_PASSWORDS.has(password.toLowerCase().trim()),
  };
}

function satisfiesAuthDbPasswordPolicy(
  password: string,
  policy: AuthDbPasswordPolicy,
): boolean {
  const checks = getAuthDbPasswordPolicyChecks(password, policy);
  return Object.values(checks).every(Boolean);
}

/** True when the string satisfies default AUTH_DB rules (mirrors backend checks). */
export function satisfiesDefaultAuthDbPasswordPolicy(
  password: string,
): boolean {
  return satisfiesAuthDbPasswordPolicy(
    password,
    AUTH_DB_DEFAULT_PASSWORD_POLICY,
  );
}

/** Returns the first validation error for a password under the given policy. */
export function getAuthDbPasswordPolicyError(
  password: string,
  policy: AuthDbPasswordPolicy = AUTH_DB_DEFAULT_PASSWORD_POLICY,
): string | null {
  const checks = getAuthDbPasswordPolicyChecks(password, policy);
  if (!checks.minLength) {
    return t(
      'Password must be at least %s characters long.',
      resolveAuthDbPasswordMinLength(policy.password_min_length),
    );
  }
  if (policy.password_require_uppercase && !checks.uppercase) {
    return t('Password must contain at least one uppercase letter.');
  }
  if (policy.password_require_lowercase && !checks.lowercase) {
    return t('Password must contain at least one lowercase letter.');
  }
  if (policy.password_require_digit && !checks.digit) {
    return t('Password must contain at least one digit.');
  }
  if (policy.password_require_special && !checks.special) {
    return t(
      'Password must contain at least one special character (not a letter, digit, or space).',
    );
  }
  if (policy.password_common_list_check && !checks.commonPassword) {
    return t('Password is too common.');
  }
  return null;
}

/**
 * Returns a random password that should pass ``validate_auth_db_password`` for the
 * supplied policy (defaults to server ``AUTH_DB_CONFIG`` defaults).
 */
export function generateAuthDbPassword(
  policy: AuthDbPasswordPolicy = AUTH_DB_DEFAULT_PASSWORD_POLICY,
): string {
  const minLen = resolveAuthDbPasswordMinLength(policy.password_min_length);
  const requiredPools = getRequiredCharacterPools(policy);
  const generationPool = getGenerationPool(policy);
  const maxAttempts = 64;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const chars: string[] = requiredPools.map(pool => pick(pool));
    while (getCodePointLength(chars.join('')) < minLen) {
      chars.push(pick(generationPool));
    }
    shuffleInPlace(chars);
    const password = chars.join('');
    if (satisfiesAuthDbPasswordPolicy(password, policy)) {
      return password;
    }
  }
  throw new Error('generateAuthDbPassword: exhausted retries');
}
