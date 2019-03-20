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
import BigNumber from 'bignumber.js';
import transform from 'src/chart/transformBigNumber';

describe('transformBigNumber', () => {
  it('should transform BigNumber on its own', () => {
    expect(transform(new BigNumber(123.456))).toBe(123.456);
  });

  it('should transform BigNumber in objects', () => {
    expect(transform({
      foo: new BigNumber(123),
      bar: 456,
      baz: null,
    })).toEqual({ foo: 123, bar: 456, baz: null });
  });

  it('should transform BigNumber in arrays', () => {
    expect(transform([
      { foo: new BigNumber(123) },
      { bar: 456 },
    ])).toEqual([{ foo: 123 }, { bar: 456 }]);
  });

  it('should transform BigNumber in nested structures', () => {
    expect(transform([{
      x: new BigNumber(123),
      y: [{ foo: new BigNumber(456) }, { bar: 'str' }],
      z: { some: [new BigNumber(789)] },
    }])).toEqual([{
      x: 123,
      y: [{ foo: 456 }, { bar: 'str' }],
      z: { some: [789] },
    }]);
  });
});
