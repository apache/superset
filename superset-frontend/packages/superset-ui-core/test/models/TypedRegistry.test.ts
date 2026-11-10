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

import { TypedRegistry } from '@superset-ui/core';

describe('TypedRegistry', () => {
  test('gets a value', () => {
    const reg = new TypedRegistry({ foo: 'bar' });
    expect(reg.get('foo')).toBe('bar');
  });

  test('sets a value', () => {
    const reg = new TypedRegistry({ foo: 'bar' });
    reg.set('foo', 'blah');
    expect(reg.get('foo')).toBe('blah');
  });

  test('notifies subscribers of a registration', () => {
    // Everything that registers at application startup does so before
    // anything renders, which is why a plain `get` was enough for a long
    // time. Extensions register after the application has mounted, so a
    // reader needs to be told to look again.
    const reg = new TypedRegistry<{ foo: string }>({ foo: 'bar' });
    const listener = jest.fn();

    reg.subscribe(listener);
    reg.set('foo', 'blah');

    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('notifies every subscriber', () => {
    const reg = new TypedRegistry<{ foo: string }>({ foo: 'bar' });
    const first = jest.fn();
    const second = jest.fn();

    reg.subscribe(first);
    reg.subscribe(second);
    reg.set('foo', 'blah');

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  test('unsubscribing stops the notifications', () => {
    const reg = new TypedRegistry<{ foo: string }>({ foo: 'bar' });
    const listener = jest.fn();

    const unsubscribe = reg.subscribe(listener);
    unsubscribe();
    reg.set('foo', 'blah');

    expect(listener).not.toHaveBeenCalled();
  });

  test('a read is still a plain read', () => {
    // Subscribing must not change what `get` returns, only when a reader
    // knows to call it.
    const reg = new TypedRegistry({ foo: 'bar' });
    reg.subscribe(jest.fn());
    expect(reg.get('foo')).toBe('bar');
  });
});
