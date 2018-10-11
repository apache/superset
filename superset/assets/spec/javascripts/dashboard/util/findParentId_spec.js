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
  test('should return the correct parentId', () => {
    expect(findParentId({ childId: 'b', layout })).toBe('a');
    expect(findParentId({ childId: 'z', layout })).toBe('b');
  });

  test('should return null if the parent cannot be found', () => {
    expect(findParentId({ childId: 'a', layout })).toBeNull();
  });
});
