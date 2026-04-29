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
/**
 * Client-side generator aligned with default ``AUTH_DB_CONFIG`` / Python
 * ``superset.utils.auth_db_password`` (minimum length, character classes, common list).
 * Keep ``AUTH_DB_COMMON_PASSWORDS`` in sync with ``_COMMON_PASSWORDS`` in that module.
 */
export const AUTH_DB_PASSWORD_MIN_LENGTH = 12;

/** Lowercased entries; keep in sync with ``_COMMON_PASSWORDS`` in auth_db_password.py */
const AUTH_DB_COMMON_PASSWORDS = new Set(
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

function secureRandomInt(maxExclusive: number): number {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0]! % maxExclusive;
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

/** True when the string satisfies default AUTH_DB rules (mirrors backend checks). */
export function satisfiesDefaultAuthDbPasswordPolicy(password: string): boolean {
  if (password.length < AUTH_DB_PASSWORD_MIN_LENGTH) {
    return false;
  }
  if (!/[A-Z]/.test(password)) {
    return false;
  }
  if (!/[a-z]/.test(password)) {
    return false;
  }
  if (!/\d/.test(password)) {
    return false;
  }
  if (![...password].some(c => !/[A-Za-z0-9]/.test(c) && !/\s/.test(c))) {
    return false;
  }
  if (AUTH_DB_COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    return false;
  }
  return true;
}

/**
 * Returns a random password that should pass ``validate_auth_db_password`` with default
 * ``AUTH_DB_CONFIG`` on the server.
 */
export function generateAuthDbPassword(): string {
  const minLen = AUTH_DB_PASSWORD_MIN_LENGTH;
  const maxAttempts = 64;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const chars: string[] = [
      pick(UPPER),
      pick(LOWER),
      pick(DIGIT),
      pick(SPECIAL),
    ];
    const pool = ALPHANUM + SPECIAL;
    while (chars.length < minLen) {
      chars.push(pick(pool));
    }
    shuffleInPlace(chars);
    const password = chars.join('');
    if (satisfiesDefaultAuthDbPasswordPolicy(password)) {
      return password;
    }
  }
  throw new Error('generateAuthDbPassword: exhausted retries');
}
