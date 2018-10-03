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

    });
    it('returns false if an item with the given key does not exist', () => {

    });
  });
  describe('.register(key, value)', () => {
    it('registers the given value with the given key', () => {

    });
    it('returns the registry itself', () => {

    });
  });
  describe('.get(key)', () => {
    it('returns the item given the key', () => {

    });
    it('returns null if the item with specified key does not exist', () => {

    });
    it('If the key was registered multiple times, returns the most recent value.', () => {

    });
  });
  describe('.getAsPromise(key)', () => {
    it('returns a promise of item given the key', () => {

    });
    it('returns a rejected promise if the item with specified key does not exist', () => {

    });
    it('If the key was registered multiple times, returns a promise of the most recent value.', () => {

    });
  });
});
