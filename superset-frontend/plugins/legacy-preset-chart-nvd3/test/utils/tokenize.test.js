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
  tokenizeToNumericArray,
  tokenizeToStringArray,
} from '../../src/utils/tokenize';

describe('tokenizeToNumericArray', () => {
  it('evals numeric strings properly', () => {
    expect(tokenizeToNumericArray('1')).toStrictEqual([1]);
    expect(tokenizeToNumericArray('1,2,3,4')).toStrictEqual([1, 2, 3, 4]);
    expect(tokenizeToNumericArray('1.1,2.2,3.0,4')).toStrictEqual([
      1.1, 2.2, 3, 4,
    ]);
    expect(tokenizeToNumericArray('   1, 2,   3,    4 ')).toStrictEqual([
      1, 2, 3, 4,
    ]);
  });

  it('evals undefined to null', () => {
    expect(tokenizeToNumericArray(undefined)).toBeNull();
  });

  it('evals empty strings to null', () => {
    expect(tokenizeToNumericArray('')).toBeNull();
    expect(tokenizeToNumericArray('    ')).toBeNull();
  });

  it('throws error on incorrect string', () => {
    expect(() => tokenizeToNumericArray('qwerty,1,2,3')).toThrow(Error);
  });
});

describe('tokenizeToStringArray', () => {
  it('evals numeric strings properly', () => {
    expect(tokenizeToStringArray('a')).toStrictEqual(['a']);
    expect(tokenizeToStringArray('1.1 , 2.2, 3.0 ,4')).toStrictEqual([
      '1.1',
      '2.2',
      '3.0',
      '4',
    ]);
    expect(tokenizeToStringArray('1.1,a,3, bc ,d')).toStrictEqual([
      '1.1',
      'a',
      '3',
      'bc',
      'd',
    ]);
  });

  it('evals undefined to null', () => {
    expect(tokenizeToStringArray(undefined)).toBeNull();
  });

  it('evals empty string to null', () => {
    expect(tokenizeToStringArray('')).toBeNull();
    expect(tokenizeToStringArray('    ')).toBeNull();
  });
});
