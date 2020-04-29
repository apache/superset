import { formatSelectOptions, formatSelectOptionsForRange } from '../src';

describe('formatSelectOptions', () => {
  it('formats an array of options', () => {
    expect(formatSelectOptions([1, 5, 10, 25, 50, 'unlimited'])).toEqual([
      [1, '1'],
      [5, '5'],
      [10, '10'],
      [25, '25'],
      [50, '50'],
      ['unlimited', 'unlimited'],
    ]);
  });
});

describe('formatSelectOptionsForRange', () => {
  it('generates select options from a range', () => {
    expect(formatSelectOptionsForRange(1, 5)).toEqual([
      [1, '1'],
      [2, '2'],
      [3, '3'],
      [4, '4'],
      [5, '5'],
    ]);
  });
});
