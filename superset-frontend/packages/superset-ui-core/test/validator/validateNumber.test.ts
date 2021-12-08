/*
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

import { validateNumber } from '@superset-ui/core/src';
import './setup';

describe('validateNumber()', () => {
  it('returns the warning message if invalid', () => {
    expect(validateNumber(NaN)).toBeTruthy();
    expect(validateNumber(Infinity)).toBeTruthy();
    expect(validateNumber(undefined)).toBeTruthy();
    expect(validateNumber(null)).toBeTruthy();
    expect(validateNumber('abc')).toBeTruthy();
    expect(validateNumber('')).toBeTruthy();
  });
  it('returns false if the input is valid', () => {
    expect(validateNumber(0)).toBeFalsy();
    expect(validateNumber(10.1)).toBeFalsy();
    expect(validateNumber(10)).toBeFalsy();
    expect(validateNumber('10')).toBeFalsy();
  });
});
