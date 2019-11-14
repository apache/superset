import combineCategories from '../../src/utils/combineCategories';

describe('combineCategories()', () => {
  it('adds all categories from the first list and add new categories from the second list at the end', () => {
    expect(combineCategories(['fish', 'beef', 'lamb'], ['lamb', 'fish', 'pork'])).toEqual([
      'fish',
      'beef',
      'lamb',
      'pork',
    ]);
  });
  it('works if the first list is empty', () => {
    expect(combineCategories([], ['lamb', 'fish', 'pork'])).toEqual(['lamb', 'fish', 'pork']);
  });
  it('works if the second list is not given', () => {
    expect(combineCategories(['fish', 'beef'])).toEqual(['fish', 'beef']);
  });
});
