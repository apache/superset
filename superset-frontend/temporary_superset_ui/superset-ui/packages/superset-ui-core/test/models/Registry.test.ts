/* eslint no-console: 0 */
import mockConsole from 'jest-mock-console';
import { Registry, OverwritePolicy } from '@superset-ui/core/src';

const loader = () => 'testValue';

describe('Registry', () => {
  it('exists', () => {
    expect(Registry !== undefined).toBe(true);
  });

  describe('new Registry(config)', () => {
    it('can create a new registry when config.name is not given', () => {
      const registry = new Registry();
      expect(registry).toBeInstanceOf(Registry);
    });
    it('can create a new registry when config.name is given', () => {
      const registry = new Registry({ name: 'abc' });
      expect(registry).toBeInstanceOf(Registry);
      expect(registry.name).toBe('abc');
    });
  });

  describe('.clear()', () => {
    it('clears all registered items', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.clear();
      expect(Object.keys(registry.items)).toHaveLength(0);
      expect(Object.keys(registry.promises)).toHaveLength(0);
    });
    it('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.clear()).toBe(registry);
    });
  });

  describe('.has(key)', () => {
    it('returns true if an item with the given key exists', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.has('a')).toBe(true);
      registry.registerLoader('b', () => 'testValue2');
      expect(registry.has('b')).toBe(true);
    });
    it('returns false if an item with the given key does not exist', () => {
      const registry = new Registry();
      expect(registry.has('a')).toBe(false);
    });
  });

  describe('.registerValue(key, value)', () => {
    it('registers the given value with the given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.has('a')).toBe(true);
      expect(registry.get('a')).toBe('testValue');
    });
    it('does not overwrite if value is exactly the same', () => {
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
    it('overwrites item with loader', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'ironman');
      expect(registry.get('a')).toBe('ironman');
      registry.registerValue('a', 'hulk');
      expect(registry.get('a')).toBe('hulk');
    });
    it('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.registerValue('a', 'testValue')).toBe(registry);
    });
  });

  describe('.registerLoader(key, loader)', () => {
    it('registers the given loader with the given key', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');
      expect(registry.has('a')).toBe(true);
      expect(registry.get('a')).toBe('testValue');
    });
    it('does not overwrite if loader is exactly the same', () => {
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
    it('overwrites item with value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'hulk');
      expect(registry.get('a')).toBe('hulk');
      registry.registerLoader('a', () => 'ironman');
      expect(registry.get('a')).toBe('ironman');
    });
    it('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.registerLoader('a', () => 'testValue')).toBe(registry);
    });
  });

  describe('.get(key)', () => {
    it('given the key, returns the value if the item is a value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.get('a')).toBe('testValue');
    });
    it('given the key, returns the result of the loader function if the item is a loader', () => {
      const registry = new Registry();
      registry.registerLoader('b', () => 'testValue2');
      expect(registry.get('b')).toBe('testValue2');
    });
    it('returns undefined if the item with specified key does not exist', () => {
      const registry = new Registry();
      expect(registry.get('a')).toBeUndefined();
    });
    it('If the key was registered multiple times, returns the most recent item.', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.get('a')).toBe('testValue');
      registry.registerLoader('a', () => 'newValue');
      expect(registry.get('a')).toBe('newValue');
    });
  });

  describe('.getAsPromise(key)', () => {
    it('given the key, returns a promise of item value if the item is a value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');

      return registry.getAsPromise('a').then(value => expect(value).toBe('testValue'));
    });
    it('given the key, returns a promise of result of the loader function if the item is a loader', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');

      return registry.getAsPromise('a').then(value => expect(value).toBe('testValue'));
    });
    it('returns same promise object for the same key unless user re-registers new value with the key.', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');
      const promise1 = registry.getAsPromise('a');
      const promise2 = registry.getAsPromise('a');
      expect(promise1).toBe(promise2);
    });
    it('returns a rejected promise if the item with specified key does not exist', () => {
      const registry = new Registry();

      return registry.getAsPromise('a').then(null, (err: Error) => {
        expect(err.toString()).toEqual('Error: Item with key "a" is not registered.');
      });
    });
    it('If the key was registered multiple times, returns a promise of the most recent item.', async () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(await registry.getAsPromise('a')).toBe('testValue');
      registry.registerLoader('a', () => 'newValue');
      expect(await registry.getAsPromise('a')).toBe('newValue');
    });
  });

  describe('.getMap()', () => {
    it('returns key-value map as plain object', () => {
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
    it('returns a promise of key-value map', () => {
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
    it('returns an array of keys', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.registerLoader('b', () => 'test2');
      expect(registry.keys()).toEqual(['a', 'b']);
    });
  });

  describe('.values()', () => {
    it('returns an array of values', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      expect(registry.values()).toEqual(['test1', 'test2']);
    });
  });

  describe('.valuesAsPromise()', () => {
    it('returns a Promise of an array { key, value }', () => {
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
    it('returns an array of { key, value }', () => {
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
    it('returns a Promise of an array { key, value }', () => {
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
    it('removes the item with given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.remove('a');
      expect(registry.get('a')).toBeUndefined();
    });
    it('does not throw error if the key does not exist', () => {
      const registry = new Registry();
      expect(() => registry.remove('a')).not.toThrow();
    });
    it('returns itself', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.remove('a')).toBe(registry);
    });
  });

  describe('config.overwritePolicy', () => {
    describe('=ALLOW', () => {
      describe('.registerValue(key, value)', () => {
        it('registers normally', () => {
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
        it('registers normally', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry();
          registry.registerLoader('a', () => 'testValue');
          expect(() => registry.registerLoader('a', () => 'testValue2')).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).not.toHaveBeenCalled();
          restoreConsole();
        });
      });
    });
    describe('=WARN', () => {
      describe('.registerValue(key, value)', () => {
        it('warns when overwrite', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.WARN,
          });
          registry.registerValue('a', 'testValue');
          expect(() => registry.registerValue('a', 'testValue2')).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).toHaveBeenCalled();
          restoreConsole();
        });
      });
      describe('.registerLoader(key, loader)', () => {
        it('warns when overwrite', () => {
          const restoreConsole = mockConsole();
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.WARN,
          });
          registry.registerLoader('a', () => 'testValue');
          expect(() => registry.registerLoader('a', () => 'testValue2')).not.toThrow();
          expect(registry.get('a')).toEqual('testValue2');
          expect(console.warn).toHaveBeenCalled();
          restoreConsole();
        });
      });
    });
    describe('=PROHIBIT', () => {
      describe('.registerValue(key, value)', () => {
        it('throws error when overwrite', () => {
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.PROHIBIT,
          });
          registry.registerValue('a', 'testValue');
          expect(() => registry.registerValue('a', 'testValue2')).toThrow();
        });
      });
      describe('.registerLoader(key, loader)', () => {
        it('warns when overwrite', () => {
          const registry = new Registry({
            overwritePolicy: OverwritePolicy.PROHIBIT,
          });
          registry.registerLoader('a', () => 'testValue');
          expect(() => registry.registerLoader('a', () => 'testValue2')).toThrow();
        });
      });
    });
  });
});
