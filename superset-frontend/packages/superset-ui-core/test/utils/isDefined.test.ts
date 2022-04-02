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

import { isDefined } from '@superset-ui/core';

describe('isDefined(value)', () => {
  it('returns true if value is not null and not undefined', () => {
    expect(isDefined(0)).toBe(true);
    expect(isDefined(1)).toBe(true);
    expect(isDefined('')).toBe(true);
    expect(isDefined('a')).toBe(true);
    expect(isDefined([])).toBe(true);
    expect(isDefined([0])).toBe(true);
    expect(isDefined([1])).toBe(true);
    expect(isDefined({})).toBe(true);
    expect(isDefined({ a: 1 })).toBe(true);
    expect(isDefined([{}])).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(isDefined(null)).toBe(false);
    expect(isDefined(undefined)).toBe(false);
  });
});
