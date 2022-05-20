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

import { makeSingleton } from '@superset-ui/core';

describe('makeSingleton()', () => {
  class Dog {
    name: string;

    isSitting?: boolean;

    constructor(name?: string) {
      this.name = name || 'Pluto';
    }

    sit() {
      this.isSitting = true;
    }
  }
  describe('makeSingleton(BaseClass)', () => {
    const getInstance = makeSingleton(Dog);

    it('returns a function for getting singleton instance of a given base class', () => {
      expect(typeof getInstance).toBe('function');
      expect(getInstance()).toBeInstanceOf(Dog);
    });
    it('returned function returns same instance across all calls', () => {
      expect(getInstance()).toBe(getInstance());
    });
  });
  describe('makeSingleton(BaseClass, ...args)', () => {
    const getInstance = makeSingleton(Dog, 'Doug');

    it('returns a function for getting singleton instance of a given base class constructed with the given arguments', () => {
      expect(typeof getInstance).toBe('function');
      expect(getInstance()).toBeInstanceOf(Dog);
      expect(getInstance().name).toBe('Doug');
    });
    it('returned function returns same instance across all calls', () => {
      expect(getInstance()).toBe(getInstance());
    });
  });
});
