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

import { Registry, RegistryWithDefaultKey } from '@superset-ui/core';

describe('RegistryWithDefaultKey', () => {
  let registry: RegistryWithDefaultKey<number>;

  beforeEach(() => {
    registry = new RegistryWithDefaultKey();
  });

  it('exists', () => {
    expect(RegistryWithDefaultKey).toBeDefined();
  });

  describe('new RegistryWithDefaultKey(config)', () => {
    it('returns a class that extends from Registry', () => {
      expect(registry).toBeInstanceOf(Registry);
    });
  });

  describe('.clear()', () => {
    it('also resets default key', () => {
      registry.setDefaultKey('abc');
      registry.clear();
      expect(registry.getDefaultKey()).toBeUndefined();
    });
    it('returns itself', () => {
      expect(registry.clear()).toBe(registry);
    });
  });

  describe('.get()', () => {
    beforeEach(() => {
      registry
        .registerValue('abc', 100)
        .registerValue('def', 200)
        .setDefaultKey('abc');
    });
    it('.get() returns value from default key', () => {
      expect(registry.get()).toEqual(100);
    });
    it('.get(key) returns value from specified key', () => {
      expect(registry.get('def')).toEqual(200);
    });
    it('returns undefined if no key was given and there is no default key', () => {
      registry.clearDefaultKey();
      expect(registry.get()).toBeUndefined();
    });
  });

  describe('.getDefaultKey()', () => {
    it('returns defaultKey', () => {
      registry.setDefaultKey('abc');
      expect(registry.getDefaultKey()).toEqual('abc');
    });
  });

  describe('.setDefaultKey(key)', () => {
    it('set the default key', () => {
      registry.setDefaultKey('abc');
      expect(registry.defaultKey).toEqual('abc');
    });
    it('returns itself', () => {
      expect(registry.setDefaultKey('ghi')).toBe(registry);
    });
  });

  describe('.clearDefaultKey()', () => {
    it('set the default key to undefined', () => {
      registry.clearDefaultKey();
      expect(registry.defaultKey).toBeUndefined();
    });
    it('returns itself', () => {
      expect(registry.clearDefaultKey()).toBe(registry);
    });
  });

  describe('config.defaultKey', () => {
    describe('when not set', () => {
      it(`After creation, default key is undefined`, () => {
        expect(registry.defaultKey).toBeUndefined();
      });
      it('.clear() reset defaultKey to undefined', () => {
        registry.setDefaultKey('abc');
        registry.clear();
        expect(registry.getDefaultKey()).toBeUndefined();
      });
    });
    describe('when config.initialDefaultKey is set', () => {
      const registry2 = new RegistryWithDefaultKey({
        initialDefaultKey: 'def',
      });
      it(`After creation, default key is undefined`, () => {
        expect(registry2.defaultKey).toEqual('def');
      });
      it('.clear() reset defaultKey to this config.defaultKey', () => {
        registry2.setDefaultKey('abc');
        registry2.clear();
        expect(registry2.getDefaultKey()).toEqual('def');
      });
    });
  });

  describe('config.setFirstItemAsDefault', () => {
    describe('when true', () => {
      const registry2 = new RegistryWithDefaultKey({
        setFirstItemAsDefault: true,
      });
      beforeEach(() => {
        registry2.clear();
      });
      describe('.registerValue(key, value)', () => {
        it('sets the default key to this key if default key is not set', () => {
          registry2.registerValue('abc', 100);
          expect(registry2.getDefaultKey()).toEqual('abc');
        });
        it('does not modify the default key if already set', () => {
          registry2.setDefaultKey('def').registerValue('abc', 100);
          expect(registry2.getDefaultKey()).toEqual('def');
        });
        it('returns itself', () => {
          expect(registry2.registerValue('ghi', 300)).toBe(registry2);
        });
      });
      describe('.registerLoader(key, loader)', () => {
        it('sets the default key to this key if default key is not set', () => {
          registry2.registerLoader('abc', () => 100);
          expect(registry2.getDefaultKey()).toEqual('abc');
        });
        it('does not modify the default key if already set', () => {
          registry2.setDefaultKey('def').registerLoader('abc', () => 100);
          expect(registry2.getDefaultKey()).toEqual('def');
        });
        it('returns itself', () => {
          expect(registry2.registerLoader('ghi', () => 300)).toBe(registry2);
        });
      });
    });
    describe('when false', () => {
      const registry2 = new RegistryWithDefaultKey({
        setFirstItemAsDefault: false,
      });
      beforeEach(() => {
        registry2.clear();
      });
      describe('.registerValue(key, value)', () => {
        it('does not modify default key', () => {
          registry2.registerValue('abc', 100);
          expect(registry2.defaultKey).toBeUndefined();
          registry2.setDefaultKey('def');
          registry2.registerValue('ghi', 300);
          expect(registry2.defaultKey).toEqual('def');
        });
        it('returns itself', () => {
          expect(registry2.registerValue('ghi', 300)).toBe(registry2);
        });
      });
      describe('.registerLoader(key, loader)', () => {
        it('does not modify default key', () => {
          registry2.registerValue('abc', () => 100);
          expect(registry2.defaultKey).toBeUndefined();
          registry2.setDefaultKey('def');
          registry2.registerValue('ghi', () => 300);
          expect(registry2.defaultKey).toEqual('def');
        });
        it('returns itself', () => {
          expect(registry2.registerLoader('ghi', () => 300)).toBe(registry2);
        });
      });
    });
  });
});
