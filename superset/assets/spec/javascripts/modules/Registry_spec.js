import Registry from '../../../src/modules/Registry';

describe('Registry', () => {
  test('exists', () => {
    expect(Registry !== undefined).toBe(true);
  });

  describe('new Registry(name)', () => {
    test('can create a new registry when name is not given', () => {
      const registry = new Registry();
      expect(registry).toBeInstanceOf(Registry);
    });
    test('can create a new registry when name is given', () => {
      const registry = new Registry('abc');
      expect(registry).toBeInstanceOf(Registry);
      expect(registry.name).toBe('abc');
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
    test(
      'given the key, returns the result of the loader function if the item is a loader',
      () => {
        const registry = new Registry();
        registry.registerLoader('b', () => 'testValue2');
        expect(registry.get('b')).toBe('testValue2');
      }
    );
    test('returns null if the item with specified key does not exist', () => {
      const registry = new Registry();
      expect(registry.get('a')).toBeNull();
    });
    test(
      'If the key was registered multiple times, returns the most recent item.',
      () => {
        const registry = new Registry();
        registry.registerValue('a', 'testValue');
        expect(registry.get('a')).toBe('testValue');
        registry.registerLoader('a', () => 'newValue');
        expect(registry.get('a')).toBe('newValue');
      }
    );
  });

  describe('.getAsPromise(key)', () => {
    test(
      'given the key, returns a promise of item value if the item is a value',
      () => {
        const registry = new Registry();
        registry.registerValue('a', 'testValue');
        return registry.getAsPromise('a').then((value) => {
          expect(value).toBe('testValue');
        });
      }
    );
    test(
      'given the key, returns a promise of result of the loader function if the item is a loader ',
      () => {
        const registry = new Registry();
        registry.registerLoader('a', () => 'testValue');
        return registry.getAsPromise('a').then((value) => {
          expect(value).toBe('testValue');
        });
      }
    );
    test(
      'returns a rejected promise if the item with specified key does not exist',
      () => {
        const registry = new Registry();
        return registry.getAsPromise('a').then(null, (err) => {
          expect(err).toBe('Item with key "a" is not registered.');
        });
      }
    );
    test(
      'If the key was registered multiple times, returns a promise of the most recent item.',
      () => {
        const registry = new Registry();
        registry.registerValue('a', 'testValue');
        const promise1 = registry.getAsPromise('a').then((value) => {
          expect(value).toBe('testValue');
        });
        registry.registerLoader('a', () => 'newValue');
        const promise2 = registry.getAsPromise('a').then((value) => {
          expect(value).toBe('newValue');
        });
        return Promise.all([promise1, promise2]);
      }
    );
  });

  describe('.keys()', () => {
    test('returns an array of keys', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.registerLoader('b', () => 'test2');
      expect(registry.keys()).toEqual(['a', 'b']);
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
      return registry.entriesAsPromise().then((entries) => {
        expect(entries).toEqual([
          { key: 'a', value: 'test1' },
          { key: 'b', value: 'test2' },
          { key: 'c', value: 'test3' },
        ]);
      });
    });
  });

  describe('.remove(key)', () => {
    test('removes the item with given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.remove('a');
      expect(registry.get('a')).toBeNull();
    });
    test('does not throw error if the key does not exist', () => {
      const registry = new Registry();
      expect(() => registry.remove('a')).not.toThrowError();
    });
    test('returns itself', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.remove('a')).toBe(registry);
    });
  });
});
