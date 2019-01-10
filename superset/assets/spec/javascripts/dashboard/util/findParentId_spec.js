import { expect } from 'chai';

import findParentId from '../../../../src/dashboard/util/findParentId';

describe('findParentId', () => {
  const layout = {
    a: {
      id: 'a',
      children: ['b', 'r', 'k'],
    },
    b: {
      id: 'b',
      children: ['x', 'y', 'z'],
    },
    z: {
      id: 'z',
      children: [],
    },
  };
  it('should return the correct parentId', () => {
    expect(findParentId({ childId: 'b', layout })).to.equal('a');
    expect(findParentId({ childId: 'z', layout })).to.equal('b');
  });

  it('should return null if the parent cannot be found', () => {
    expect(findParentId({ childId: 'a', layout })).to.equal(null);
  });
});
