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

import roundDecimal from '../../src/utils/roundDecimal';

describe('roundDecimal', () => {
  it('rounding method to limit the number of decimal digits', () => {
    expect(roundDecimal(1.139, 2)).toBe(1.14);
    expect(roundDecimal(1.13929, 3)).toBe(1.139);
    expect(roundDecimal(1.13929)).toBe(1);
  });
});
