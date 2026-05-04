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

/* eslint no-console: 0 */
import mockConsole from 'jest-mock-console';
import { Registry, OverwritePolicy } from '@superset-ui/core';

const loader = () => 'testValue';

describe('Registry', () => {
  test('exists', () => {
    expect(Registry !== undefined).toBe(true);
  });

  describe('new Registry(config)', () => {
    test('can create a new registry when config.name is not given', () => {
      const registry = new Registry();
      expect(registry).toBeInstanceOf(Registry);
    });
    test('can create a new registry when config.name is given', () => {
      const registry = new Registry({ name: 'abc' });
      expect(registry).toBeInstanceOf(Registry);
      expect(registry.name).toBe('abc');
    });
  });

  describe('.clear()', () => {
    test('clears all registered items', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.clear();
      expect(Object.keys(registry.items)).toHaveLength(0);
      expect(Object.keys(registry.promises)).toHaveLength(0);
    });
    test('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.clear()).toBe(registry);
    });
  });

  describe('.has(key)', () => {
    test('returns true if an item with the given key exists', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.has('a')).toBe(true);
      registry.registerLoader('b', () => 'testValue2');
      expect(registry.has('b')).toBe(true);
    });
    test('returns false if an item with the given key does not exist', () => {
      const registry = new Registry();
      expect(registry.has('a')).toBe(false);
    });
  });

  describe('.registerValue(key, value)', () => {
    test('registers the given value with the given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.has('a')).toBe(true);
      expect(registry.get('a')).toBe('testValue');
    });
    test('does not overwrite if value is exactly the same', () => {
      const registry = new Registry();
      const value = { a: 1 };
      registry.registerValue('a', value);
      const promise1 = registry.getAsPromise('a');
      registry.registerValue('a', value);
      const promise2 = registry.getAsPromise('a');
      expect(promise1).toBe(promise2);
      registry.registerValue('a', { a: 1 });
      const promise3 = registry.getAsPromise('a');
      expect(promise1).not.toBe(promise3);
    });
    test('overwrites item with loader', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'ironman');
      expect(registry.get('a')).toBe('ironman');
      registry.registerValue('a', 'hulk');
      expect(registry.get('a')).toBe('hulk');
    });
    test('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.registerValue('a', 'testValue')).toBe(registry);
    });
  });

  describe('.registerLoader(key, loader)', () => {
    test('registers the given loader with the given key', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');
      expect(registry.has('a')).toBe(true);
      expect(registry.get('a')).toBe('testValue');
    });
    test('does not overwrite if loader is exactly the same', () => {
      const registry = new Registry();
      registry.registerLoader('a', loader);
      const promise1 = registry.getAsPromise('a');
      registry.registerLoader('a', loader);
      const promise2 = registry.getAsPromise('a');
      expect(promise1).toBe(promise2);
      registry.registerLoader('a', () => 'testValue');
      const promise3 = registry.getAsPromise('a');
      expect(promise1).not.toBe(promise3);
    });
    test('overwrites item with value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'hulk');
      expect(registry.get('a')).toBe('hulk');
      registry.registerLoader('a', () => 'ironman');
      expect(registry.get('a')).toBe('ironman');
    });
    test('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.registerLoader('a', () => 'testValue')).toBe(registry);
    });
  });

  describe('.get(key)', () => {
    test('given the key, returns the value if the item is a value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.get('a')).toBe('testValue');
    });
    test('given the key, returns the result of the loader function if the item is a loader', () => {
      const registry = new Registry();
      registry.registerLoader('b', () => 'testValue2');
      expect(registry.get('b')).toBe('testValue2');
    });
    test('returns undefined if the item with specified key does not exist', () => {
      const registry = new Registry();
      expect(registry.get('a')).toBeUndefined();
    });
    test('If the key was registered multiple times, returns the most recent item.', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.get('a')).toBe('testValue');
      registry.registerLoader('a', () => 'newValue');
      expect(registry.get('a')).toBe('newValue');
    });
  });

  describe('.getAsPromise(key)', () => {
    test('given the key, returns a promise of item value if the item is a value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');

      return registry
        .getAsPromise('a')
        .then(value => expect(value).toBe('testValue'));
    });
    test('given the key, returns a promise of result of the loader function if the item is a loader', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');

      return registry
        .getAsPromise('a')
        .then(value => expect(value).toBe('testValue'));
    });
    test('returns same promise object for the same key unless user re-registers new value with the key.', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');
      const promise1 = registry.getAsPromise('a');
      const promise2 = registry.getAsPromise('a');
      expect(promise1).toBe(promise2);
    });
    test('returns a rejected promise if the item with specified key does not exist', () => {
      const registry = new Registry();

      return registry.getAsPromise('a').then(null, (err: Error) => {
        expect(err.toString()).toEqual(
          'Error: Item with key "a" is not registered.',
        );
      });
    });
    test('If the key was registered multiple times, returns a promise of the most recent item.', async () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(await registry.getAsPromise('a')).toBe('testValue');
      registry.registerLoader('a', () => 'newValue');
      expect(await registry.getAsPromise('a')).toBe('newValue');
    });
  });

  describe('.getMap()', () => {
    test('returns key-value map as plain object', () => {
      const registry = new Registry();
      registry.registerValue('a', 'cat');
      registry.registerLoader('b', () => 'dog');
      expect(registry.getMap()).toEqual({
        a: 'cat',
        b: 'dog',
      });
    });
  });

  describe('.getMapAsPromise()', () => {
    test('returns a promise of key-value map', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      registry.registerLoader('c', () => Promise.resolve('test3'));

      return registry.getMapAsPromise().then(map =>
        expect(map).toEqual({
          a: 'test1',
          b: 'test2',
          c: 'test3',
        }),
      );
    });
  });

  describe('.keys()', () => {
    test('returns an array of keys', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.registerLoader('b', () => 'test2');
      expect(registry.keys()).toEqual(['a', 'b']);
    });
  });

  describe('.values()', () => {
    test('returns an array of values', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      expect(registry.values()).toEqual(['test1', 'test2']);
    });
  });

  describe('.valuesAsPromise()', () => {
    test('returns a Promise of an array { key, value }', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      registry.registerLoader('c', () => Promise.resolve('test3'));

      return registry
        .valuesAsPromise()
        .then(entries => expect(entries).toEqual(['test1', 'test2', 'test3']));
    });
  });

  describe('.entries()', () => {
    test('returns an array of { key, value }', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      expect(registry.entries()).toEqual([
        { key: 'a', value: 'test1' },
        { key: 'b', value: 'test2' },
      ]);
    });
  });

  describe('.entriesAsPromise()', () => {
    test('returns a Promise of an array { key, value }', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      registry.registerLoader('c', () => Promise.resolve('test3'));

      return registry.entriesAsPromise().then(entries =>
        expect(entries).toEqual([
          { key: 'a', value: 'test1' },
          { key: 'b', value: 'test2' },
          { key: 'c', value: 'test3' },
        ]),
      );
    });
  });

  describe('.remove(key)', () => {
    test('removes the item with given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.remove('a');
      expect(registry.get('a')).toBeUndefined();
    });
    test('does not throw error if the key does not exist', () => {
      const registry = new Registry();
      expect(() => registry.remove('a')).not.toThrow();
    });
    test('returns itself', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.remove('a')).toBe(registry);
    });
  });

  describe('config.overwritePolicy', () => {
    describe('=ALLOW', () => {
      describe('.registerValue(key, value)', () => {
        test('registers normally', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry();
          registry.registerValue('a', 'testValue');
          expect(() => registry.registerValue('a', 'testValue2')).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).not.toHaveBeenCalled();
          restoreConsole();
        });
      });
      describe('.registerLoader(key, loader)', () => {
        test('registers normally', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry();
          registry.registerLoader('a', () => 'testValue');
          expect(() =>
            registry.registerLoader('a', () => 'testValue2'),
          ).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).not.toHaveBeenCalled();
          restoreConsole();
        });
      });
    });
    describe('=WARN', () => {
      describe('.registerValue(key, value)', () => {
        test('warns when overwrite', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.Warn,
          });
          registry.registerValue('a', 'testValue');
          expect(() => registry.registerValue('a', 'testValue2')).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).toHaveBeenCalled();
          restoreConsole();
        });
      });
      describe('.registerLoader(key, loader)', () => {
        test('warns when overwrite', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.Warn,
          });
          registry.registerLoader('a', () => 'testValue');
          expect(() =>
            registry.registerLoader('a', () => 'testValue2'),
          ).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).toHaveBeenCalled();
          restoreConsole();
        });
      });
    });
    describe('=PROHIBIT', () => {
      describe('.registerValue(key, value)', () => {
        test('throws error when overwrite', () => {
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.Prohibit,
          });
          registry.registerValue('a', 'testValue');
          expect(() => registry.registerValue('a', 'testValue2')).toThrow();
        });
      });
      describe('.registerLoader(key, loader)', () => {
        test('warns when overwrite', () => {
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.Prohibit,
          });
          registry.registerLoader('a', () => 'testValue');
          expect(() =>
            registry.registerLoader('a', () => 'testValue2'),
          ).toThrow();
        });
      });
    });
  });

  describe('listeners', () => {
    let registry = new Registry();
    let listener = jest.fn();
    beforeEach(() => {
      registry = new Registry();
      listener = jest.fn();
      registry.addListener(listener);
    });

    test('calls the listener when a value is registered', () => {
      registry.registerValue('foo', 'bar');
      expect(listener).toHaveBeenCalledWith(['foo']);
    });

    test('calls the listener when a loader is registered', () => {
      registry.registerLoader('foo', () => 'bar');
      expect(listener).toHaveBeenCalledWith(['foo']);
    });

    test('calls the listener when a value is overridden', () => {
      registry.registerValue('foo', 'bar');
      listener.mockClear();
      registry.registerValue('foo', 'baz');
      expect(listener).toHaveBeenCalledWith(['foo']);
    });

    test('calls the listener when a value is removed', () => {
      registry.registerValue('foo', 'bar');
      listener.mockClear();
      registry.remove('foo');
      expect(listener).toHaveBeenCalledWith(['foo']);
    });

    test('does not call the listener when a value is not actually removed', () => {
      registry.remove('foo');
      expect(listener).not.toHaveBeenCalled();
    });

    test('calls the listener when registry is cleared', () => {
      registry.registerValue('foo', 'bar');
      registry.registerLoader('fluz', () => 'baz');
      listener.mockClear();
      registry.clear();
      expect(listener).toHaveBeenCalledWith(['foo', 'fluz']);
    });

    test('removes listeners correctly', () => {
      registry.removeListener(listener);
      registry.registerValue('foo', 'bar');
      expect(listener).not.toHaveBeenCalled();
    });

    describe('with a broken listener', () => {
      let restoreConsole: any;
      beforeEach(() => {
        restoreConsole = mockConsole();
      });
      afterEach(() => {
        restoreConsole();
      });

      test('keeps working', () => {
        const errorListener = jest.fn().mockImplementation(() => {
          throw new Error('test error');
        });
        const lastListener = jest.fn();

        registry.addListener(errorListener);
        registry.addListener(lastListener);
        registry.registerValue('foo', 'bar');

        expect(listener).toHaveBeenCalledWith(['foo']);
        expect(errorListener).toHaveBeenCalledWith(['foo']);
        expect(lastListener).toHaveBeenCalledWith(['foo']);
        expect(console.error).toHaveBeenCalled();
      });
    });
  });
});
