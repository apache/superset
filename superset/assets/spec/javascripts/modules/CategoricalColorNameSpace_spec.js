import { it, describe } from 'mocha';
import { expect } from 'chai';
import CategoricalColorNamespace from '../../../src/modules/CategoricalColorNamespace';

describe.only('CategoricalColorNamespace', () => {
  it('exists', () => {
    expect(CategoricalColorNamespace !== undefined).to.equal(true);
  });
});
