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

import { legacyValidateNumber } from '@superset-ui/core';
import './setup';

describe('legacyValidateNumber()', () => {
  it('returns the warning message if invalid', () => {
    expect(legacyValidateNumber('abc')).toBeTruthy();
  });
  it('returns false if the input is valid', () => {
    // superset seems to operate on this incorrect behavior at the moment
    expect(legacyValidateNumber(NaN)).toBeFalsy();
    expect(legacyValidateNumber(Infinity)).toBeFalsy();
    expect(legacyValidateNumber(undefined)).toBeFalsy();
    expect(legacyValidateNumber(null)).toBeFalsy();
    expect(legacyValidateNumber('')).toBeFalsy();

    expect(legacyValidateNumber(0)).toBeFalsy();
    expect(legacyValidateNumber(10.1)).toBeFalsy();
    expect(legacyValidateNumber(10)).toBeFalsy();
    expect(legacyValidateNumber('10')).toBeFalsy();
  });
});
