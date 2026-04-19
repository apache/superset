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
  AUTH_DB_PASSWORD_MIN_LENGTH,
  generateAuthDbPassword,
  satisfiesDefaultAuthDbPasswordPolicy,
} from './generateAuthDbPassword';

test('generateAuthDbPassword returns policy-compliant passwords', () => {
  for (let i = 0; i < 20; i += 1) {
    const pwd = generateAuthDbPassword();
    expect(pwd.length).toBeGreaterThanOrEqual(AUTH_DB_PASSWORD_MIN_LENGTH);
    expect(satisfiesDefaultAuthDbPasswordPolicy(pwd)).toBe(true);
  }
});

test('satisfiesDefaultAuthDbPasswordPolicy rejects weak and common passwords', () => {
  expect(satisfiesDefaultAuthDbPasswordPolicy('short')).toBe(false);
  expect(satisfiesDefaultAuthDbPasswordPolicy('password')).toBe(false);
  expect(satisfiesDefaultAuthDbPasswordPolicy('NoDigitsHere!!!!')).toBe(false);
  expect(satisfiesDefaultAuthDbPasswordPolicy('Password123')).toBe(false);
});
