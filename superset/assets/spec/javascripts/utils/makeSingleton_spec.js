import { describe, it } from 'mocha';
import { expect } from 'chai';
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

    it('returns a function for getting singleton instance of a given base class', () => {
      expect(getInstance).to.be.a('Function');
      expect(getInstance()).to.be.instanceOf(Dog);
    });
    it('returned function returns same instance across all calls', () => {
      expect(getInstance()).to.equal(getInstance());
    });
  });
  describe('makeSingleton(BaseClass, ...args)', () => {
    const getInstance = makeSingleton(Dog, 'Doug');

    it('returns a function for getting singleton instance of a given base class constructed with the given arguments', () => {
      expect(getInstance).to.be.a('Function');
      expect(getInstance()).to.be.instanceOf(Dog);
      expect(getInstance().name).to.equal('Doug');
    });
    it('returned function returns same instance across all calls', () => {
      expect(getInstance()).to.equal(getInstance());
    });
  });

});
