import { hexToRGB } from '../../src/utils/colors';

describe('colors', () => {
  it('hexToRGB()', () => {
    expect(hexToRGB('#ffffff')).toEqual([255, 255, 255, 255]);
  });
});
