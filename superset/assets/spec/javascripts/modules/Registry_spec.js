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
      registry.register('a', 'testValue');
      expect(registry.has('a')).to.equal(true);
    });
    it('returns false if an item with the given key does not exist', () => {
      const registry = new Registry();
      expect(registry.has('a')).to.equal(false);
    });
  });
  describe('.register(key, value)', () => {
    it('registers the given value with the given key', () => {
      const registry = new Registry();
      registry.register('a', 'testValue');
      expect(registry.has('a')).to.equal(true);
      expect(registry.get('a')).to.equal('testValue');
    });
    it('returns the registry itself', () => {
      const registry = new Registry();
      expect(registry.register('a', 'testValue')).to.equal(registry);
    });
  });
  describe('.get(key)', () => {
    it('returns the item given the key', () => {
      const registry = new Registry();
      registry.register('a', 'testValue');
      expect(registry.get('a')).to.equal('testValue');
    });
    it('returns null if the item with specified key does not exist', () => {
      const registry = new Registry();
      expect(registry.get('a')).to.equal(null);
    });
    it('If the key was registered multiple times, returns the most recent value.', () => {
      const registry = new Registry();
      registry.register('a', 'testValue');
      expect(registry.get('a')).to.equal('testValue');
      registry.register('a', 'newValue');
      expect(registry.get('a')).to.equal('newValue');
    });
  });
  describe('.getAsPromise(key)', () => {
    it('returns a promise of item given the key', () => {
      const registry = new Registry();
      registry.register('a', 'testValue');
      return registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('testValue');
      });
    });
    it('returns a rejected promise if the item with specified key does not exist', () => {
      const registry = new Registry();
      return registry.getAsPromise('a').then(null, (err) => {
        expect(err).to.equal('[Registry] Item with key "a" is not registered.');
      });
    });
    it('If the key was registered multiple times, returns a promise of the most recent value.', () => {
      const registry = new Registry();
      registry.register('a', 'testValue');
      const promise1 = registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('testValue');
      });
      registry.register('a', 'newValue');
      const promise2 = registry.getAsPromise('a').then((value) => {
        expect(value).to.equal('newValue');
      });
      return Promise.all([promise1, promise2]);
    });
  });
});
