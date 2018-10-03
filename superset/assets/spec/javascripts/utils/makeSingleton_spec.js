import { describe, it } from 'mocha';
import { expect } from 'chai';
import makeSingleton from "../../../src/utils/makeSingleton";

describe('makeSingleton(BaseClass)', () => {
  class Dog {
    sit() {
      this.isSitting = true;
    }
  }
  const getInstance = makeSingleton(Dog);

  it('returns a function for getting singleton instance of a given base class', () => {
    expect(getInstance).to.be.a('Function');
    expect(getInstance()).to.be.instanceOf(Dog);
  });
  it('returned function returns same instance across all calls', () => {
    expect(getInstance()).to.equal(getInstance());
  });
});
