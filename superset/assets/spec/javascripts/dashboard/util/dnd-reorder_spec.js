import { expect } from 'chai';

import reorderItem from '../../../../src/dashboard/util/dnd-reorder';

describe('dnd-reorderItem', () => {
  it('should remove the item from its source entity and add it to its destination entity', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
        b: {
          id: 'b',
          children: ['banana'],
        },
      },
      source: { id: 'a', index: 2 },
      destination: { id: 'b', index: 1 },
    });

    expect(result.a.children).to.deep.equal(['x', 'y']);
    expect(result.b.children).to.deep.equal(['banana', 'z']);
  });

  it('should correctly move elements within the same list', () => {
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
      },
      source: { id: 'a', index: 2 },
      destination: { id: 'a', index: 0 },
    });

    expect(result.a.children).to.deep.equal(['z', 'x', 'y']);
  });

  it('should copy items that do not move into the result', () => {
    const extraEntity = {};
    const result = reorderItem({
      entitiesMap: {
        a: {
          id: 'a',
          children: ['x', 'y', 'z'],
        },
        b: {
          id: 'b',
          children: ['banana'],
        },
        iAmExtra: extraEntity,
      },
      source: { id: 'a', index: 2 },
      destination: { id: 'b', index: 1 },
    });

    expect(result.iAmExtra === extraEntity).to.equal(true);
  });
});
