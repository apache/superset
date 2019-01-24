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
import sandboxedEval from '../../../src/modules/sandbox';

describe('sandboxedEval', () => {
  it('works like a basic eval', () => {
    expect(sandboxedEval('100')).toBe(100);
    expect(sandboxedEval('v => v * 2')(5)).toBe(10);
  });
  it('d3 is in context and works', () => {
    expect(sandboxedEval("l => _.find(l, s => s === 'bar')")(['foo', 'bar'])).toBe('bar');
  });
  it('passes context as expected', () => {
    expect(sandboxedEval('foo', { foo: 'bar' })).toBe('bar');
  });
});
