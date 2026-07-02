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
  AUTH_DB_DEFAULT_PASSWORD_POLICY,
  AUTH_DB_PASSWORD_MIN_LENGTH,
  generateAuthDbPassword,
  getAuthDbPasswordPolicyChecks,
  getAuthDbPasswordPolicyError,
  satisfiesDefaultAuthDbPasswordPolicy,
} from './generateAuthDbPassword';

test('generateAuthDbPassword returns policy-compliant passwords', () => {
  for (let i = 0; i < 20; i += 1) {
    const pwd = generateAuthDbPassword();
    expect(Array.from(pwd).length).toBeGreaterThanOrEqual(
      AUTH_DB_PASSWORD_MIN_LENGTH,
    );
    expect(satisfiesDefaultAuthDbPasswordPolicy(pwd)).toBe(true);
  }
});

test('generateAuthDbPassword honors a custom minimum length policy', () => {
  const policy = {
    ...AUTH_DB_DEFAULT_PASSWORD_POLICY,
    password_min_length: 20,
  };
  for (let i = 0; i < 10; i += 1) {
    const pwd = generateAuthDbPassword(policy);
    expect(Array.from(pwd).length).toBeGreaterThanOrEqual(20);
    expect(getAuthDbPasswordPolicyError(pwd, policy)).toBeNull();
  }
});

test('getAuthDbPasswordPolicyChecks counts Unicode code points for min length', () => {
  const policy = {
    ...AUTH_DB_DEFAULT_PASSWORD_POLICY,
    password_min_length: 2,
    password_require_uppercase: false,
    password_require_lowercase: false,
    password_require_digit: false,
    password_require_special: false,
    password_common_list_check: false,
  };
  expect(getAuthDbPasswordPolicyChecks('a😀', policy).minLength).toBe(true);
  expect(getAuthDbPasswordPolicyChecks('😀', policy).minLength).toBe(false);
});

test('getAuthDbPasswordPolicyError respects disabled uppercase requirement', () => {
  const policy = {
    ...AUTH_DB_DEFAULT_PASSWORD_POLICY,
    password_require_uppercase: false,
  };
  const password = 'abcdefghijklm1!';
  expect(getAuthDbPasswordPolicyError(password, policy)).toBeNull();
});

test('getAuthDbPasswordPolicyError rejects bcrypt passwords over the byte limit', () => {
  const password = `Aa1!${'x'.repeat(69)}`;
  expect(getAuthDbPasswordPolicyError(password)).toMatch(/72 bytes/);
});

test('getAuthDbPasswordPolicyError skips bcrypt byte limit for argon2', () => {
  const policy = {
    ...AUTH_DB_DEFAULT_PASSWORD_POLICY,
    password_hash_algorithm: 'argon2' as const,
    password_require_uppercase: false,
    password_require_lowercase: false,
    password_require_digit: false,
    password_require_special: false,
    password_common_list_check: false,
    password_min_length: 1,
  };
  const password = 'A'.repeat(80);
  expect(getAuthDbPasswordPolicyError(password, policy)).toBeNull();
});

test('satisfiesDefaultAuthDbPasswordPolicy rejects weak and common passwords', () => {
  expect(satisfiesDefaultAuthDbPasswordPolicy('short')).toBe(false);
  expect(satisfiesDefaultAuthDbPasswordPolicy('password')).toBe(false);
  expect(satisfiesDefaultAuthDbPasswordPolicy('NoDigitsHere!!!!')).toBe(false);
  expect(satisfiesDefaultAuthDbPasswordPolicy('Password123')).toBe(false);
});

test('getAuthDbPasswordPolicyChecks treats Unicode letters as alphanumeric', () => {
  const unicodeLettersOnly = 'Äbcdefghijkl1';
  const checks = getAuthDbPasswordPolicyChecks(unicodeLettersOnly);
  expect(checks.special).toBe(false);
  expect(checks.minLength).toBe(true);
  expect(checks.digit).toBe(true);
});

test('getAuthDbPasswordPolicyChecks still requires a true special character', () => {
  const withSpecial = 'Abcdefghijk!1';
  expect(getAuthDbPasswordPolicyChecks(withSpecial).special).toBe(true);
});

test('getAuthDbPasswordPolicyChecks accepts any length when min length is zero', () => {
  const policy = {
    ...AUTH_DB_DEFAULT_PASSWORD_POLICY,
    password_min_length: 0,
    password_require_uppercase: false,
    password_require_lowercase: false,
    password_require_digit: false,
    password_require_special: false,
    password_common_list_check: false,
  };
  expect(getAuthDbPasswordPolicyChecks('', policy).minLength).toBe(true);
  expect(getAuthDbPasswordPolicyChecks('a', policy).minLength).toBe(true);
  expect(getAuthDbPasswordPolicyError('a', policy)).toBeNull();
});

test('generateAuthDbPassword never returns empty when policy allows zero length', () => {
  const policy = {
    ...AUTH_DB_DEFAULT_PASSWORD_POLICY,
    password_min_length: 0,
    password_require_uppercase: false,
    password_require_lowercase: false,
    password_require_digit: false,
    password_require_special: false,
    password_common_list_check: false,
  };
  for (let i = 0; i < 10; i += 1) {
    const pwd = generateAuthDbPassword(policy);
    expect(pwd.length).toBeGreaterThanOrEqual(1);
    expect(getAuthDbPasswordPolicyError(pwd, policy)).toBeNull();
  }
});
