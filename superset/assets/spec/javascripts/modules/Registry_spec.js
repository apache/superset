import { describe, it } from 'mocha';
import { expect } from 'chai';
import Registry from '../../../src/modules/Registry';

describe('Registry', () => {
  it('exists', () => {
    expect(Registry !== undefined).to.equal(true);
  });

  describe('new Registry(name)', () => {
    it('can create a new registry when name is not given', () => {
      const registry = new Registry();
      expect(registry).to.be.instanceOf(Registry);
    });
    it('can create a new registry when name is given', () => {
      const registry = new Registry('abc');
      expect(registry).to.be.instanceOf(Registry);
      expect(registry.name).to.equal('abc');
    });
  });

  describe('.has(key)', () => {
    it('returns true if an item with the given key exists', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.has('a')).to.equal(true);
      registry.registerLoader('b', () => 'testValue2');
      expect(registry.has('b')).to.equal(true);
    });
    it('returns false if an item with the given key does not exist', () => {
      const registry = new Registry();
      expect(registry.has('a')).to.equal(false);
    });
  });

  describe('.registerValue(key, value)', () => {
    it('registers the given value with the given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.has('a')).to.equal(true);
      expect(registry.get('a')).to.equal('testValue');
    });
    it('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.registerValue('a', 'testValue')).to.equal(registry);
    });
  });

  describe('.registerLoader(key, loader)', () => {
    it('registers the given loader with the given key', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');
      expect(registry.has('a')).to.equal(true);
      expect(registry.get('a')).to.equal('testValue');
    });
    it('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.registerLoader('a', () => 'testValue')).to.equal(registry);
    });
  });

  describe('.get(key)', () => {
    it('given the key, returns the value if the item is a value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.get('a')).to.equal('testValue');
    });
    it('given the key, returns the result of the loader function if the item is a loader', () => {
      const registry = new Registry();
      registry.registerLoader('b', () => 'testValue2');
      expect(registry.get('b')).to.equal('testValue2');
    });
    it('returns null if the item with specified key does not exist', () => {
      const registry = new Registry();
      expect(registry.get('a')).to.equal(null);
    });
    it('If the key was registered multiple times, returns the most recent item.', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.get('a')).to.equal('testValue');
      registry.registerLoader('a', () => 'newValue');
      expect(registry.get('a')).to.equal('newValue');
    });
  });

  describe('.getAsPromise(key)', () => {
    it('given the key, returns a promise of item value if the item is a value', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      return registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('testValue');
      });
    });
    it('given the key, returns a promise of result of the loader function if the item is a loader ', () => {
      const registry = new Registry();
      registry.registerLoader('a', () => 'testValue');
      return registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('testValue');
      });
    });
    it('returns a rejected promise if the item with specified key does not exist', () => {
      const registry = new Registry();
      return registry.getAsPromise('a').then(null, (err) => {
        expect(err).to.equal('Item with key "a" is not registered.');
      });
    });
    it('If the key was registered multiple times, returns a promise of the most recent item.', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      const promise1 = registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('testValue');
      });
      registry.registerLoader('a', () => 'newValue');
      const promise2 = registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('newValue');
      });
      return Promise.all([promise1, promise2]);
    });
  });

  describe('.keys()', () => {
    it('returns an array of keys', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.registerLoader('b', () => 'test2');
      expect(registry.keys()).to.deep.equal(['a', 'b']);
    });
  });

  describe('.entries()', () => {
    it('returns an array of { key, value }', () => {
      const registry = new Registry();
      registry.registerValue('a', 'test1');
      registry.registerLoader('b', () => 'test2');
      expect(registry.entries()).to.deep.equal([
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
      return registry.entriesAsPromise().then((entries) => {
        expect(entries).to.deep.equal([
          { key: 'a', value: 'test1' },
          { key: 'b', value: 'test2' },
          { key: 'c', value: 'test3' },
        ]);
      });
    });
  });

  describe('.remove(key)', () => {
    it('removes the item with given key', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      registry.remove('a');
      expect(registry.get('a')).to.equal(null);
    });
    it('does not throw error if the key does not exist', () => {
      const registry = new Registry();
      expect(() => registry.remove('a')).to.not.throw();
    });
    it('returns itself', () => {
      const registry = new Registry();
      registry.registerValue('a', 'testValue');
      expect(registry.remove('a')).to.equal(registry);
    });
  });
});
