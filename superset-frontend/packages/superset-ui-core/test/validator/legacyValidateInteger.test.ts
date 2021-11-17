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

import { legacyValidateInteger } from '@superset-ui/core/src';
import './setup';

describe('legacyValidateInteger()', () => {
  it('returns the warning message if invalid', () => {
    expect(legacyValidateInteger(10.1)).toBeTruthy();
    expect(legacyValidateInteger('abc')).toBeTruthy();
    expect(legacyValidateInteger(Infinity)).toBeTruthy();
  });
  it('returns false if the input is valid', () => {
    // superset seems to operate on this incorrect behavior at the moment
    expect(legacyValidateInteger(NaN)).toBeFalsy();
    expect(legacyValidateInteger(undefined)).toBeFalsy();
    expect(legacyValidateInteger(null)).toBeFalsy();
    expect(legacyValidateInteger('')).toBeFalsy();

    expect(legacyValidateInteger(0)).toBeFalsy();
    expect(legacyValidateInteger(10)).toBeFalsy();
    expect(legacyValidateInteger('10')).toBeFalsy();
  });
});
