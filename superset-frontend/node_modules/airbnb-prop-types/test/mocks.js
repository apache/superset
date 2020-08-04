import { expect } from 'chai';
import entries from 'object.entries';
import values from 'object.values';

import mocks from '../build/mocks';
import implementations from '..';

describe('mocks', () => {
  it('has the same keys', () => {
    expect(Object.keys(mocks)).to.eql(Object.keys(implementations));
  });

  it('matches the types', () => {
    const mockTypes = values(mocks).map((x) => typeof x);
    const implementationTypes = values(implementations).map((x) => typeof x);
    expect(mockTypes).to.eql(implementationTypes);
  });

  it('provides a thunk for a validator function', () => {
    entries(mocks).forEach(([name, mock]) => {
      const validator = mock();
      const isSpecialCase = name === 'forbidExtraProps' || name === 'nonNegativeInteger';
      const expectedType = isSpecialCase ? 'object' : 'function';
      expect([name, typeof validator]).to.eql([name, expectedType]);
      if (!isSpecialCase) {
        expect(validator).not.to.throw();
      }
    });
  });

  it('provides a validator with isRequired', () => {
    entries(mocks).forEach(([name, mock]) => {
      if (name === 'forbidExtraProps') return;
      const validator = name === 'nonNegativeInteger' ? mock : mock();
      expect([name, typeof validator.isRequired]).to.eql([name, 'function']);
    });
  });
});
