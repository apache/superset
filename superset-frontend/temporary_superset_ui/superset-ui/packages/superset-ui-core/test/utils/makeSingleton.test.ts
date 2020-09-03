import { makeSingleton } from '@superset-ui/core/src';

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
