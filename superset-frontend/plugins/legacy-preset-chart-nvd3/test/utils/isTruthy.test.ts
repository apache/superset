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
import isTruthy from '../../src/utils/isTruthy';

describe('isTruthy', () => {
  it('evals false-looking strings properly', () => {
    expect(isTruthy('f')).toBe(false);
    expect(isTruthy('false')).toBe(false);
    expect(isTruthy('no')).toBe(false);
    expect(isTruthy('n')).toBe(false);
    expect(isTruthy('F')).toBe(false);
    expect(isTruthy('False')).toBe(false);
    expect(isTruthy('NO')).toBe(false);
    expect(isTruthy('N')).toBe(false);
  });
  it('evals true-looking strings properly', () => {
    expect(isTruthy('t')).toBe(true);
    expect(isTruthy('true')).toBe(true);
    expect(isTruthy('yes')).toBe(true);
    expect(isTruthy('y')).toBe(true);
    expect(isTruthy('Y')).toBe(true);
    expect(isTruthy('True')).toBe(true);
    expect(isTruthy('Yes')).toBe(true);
    expect(isTruthy('YES')).toBe(true);
  });
  it('evals bools properly', () => {
    expect(isTruthy(false)).toBe(false);
    expect(isTruthy(true)).toBe(true);
  });
  it('evals ints properly', () => {
    expect(isTruthy(0)).toBe(false);
    expect(isTruthy(1)).toBe(true);
  });
  it('evals constants properly', () => {
    expect(isTruthy(null)).toBe(false);
    expect(isTruthy(undefined)).toBe(false);
  });
  it('string auto is false', () => {
    expect(isTruthy('false')).toBe(false);
  });
});
