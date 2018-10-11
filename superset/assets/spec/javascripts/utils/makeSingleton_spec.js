import makeSingleton from '../../../src/utils/makeSingleton';

describe('makeSingleton()', () => {
  class Dog {
    constructor(name) {
      this.name = name;
    }
    sit() {
      this.isSitting = true;
    }
  }
  describe('makeSingleton(BaseClass)', () => {
    const getInstance = makeSingleton(Dog);

    test(
      'returns a function for getting singleton instance of a given base class',
      () => {
        expect(typeof getInstance).toBe('function');
        expect(getInstance()).toBeInstanceOf(Dog);
      }
    );
    test('returned function returns same instance across all calls', () => {
      expect(getInstance()).toBe(getInstance());
    });
  });
  describe('makeSingleton(BaseClass, ...args)', () => {
    const getInstance = makeSingleton(Dog, 'Doug');

    test(
      'returns a function for getting singleton instance of a given base class constructed with the given arguments',
      () => {
        expect(typeof getInstance).toBe('function');
        expect(getInstance()).toBeInstanceOf(Dog);
        expect(getInstance().name).toBe('Doug');
      }
    );
    test('returned function returns same instance across all calls', () => {
      expect(getInstance()).toBe(getInstance());
    });
  });

});
