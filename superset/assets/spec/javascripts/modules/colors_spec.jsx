import { hexToRGB } from '../../../src/modules/colors';

describe('colors', () => {
  it('hexToRGB converts properly', () => {
    expect(hexToRGB('#FFFFFF')).toEqual(expect.arrayContaining([255, 255, 255, 255]));
    expect(hexToRGB('#000000')).toEqual(expect.arrayContaining([0, 0, 0, 255]));
    expect(hexToRGB('#FF0000')).toEqual(expect.arrayContaining([255, 0, 0, 255]));
    expect(hexToRGB('#00FF00')).toEqual(expect.arrayContaining([0, 255, 0, 255]));
    expect(hexToRGB('#0000FF')).toEqual(expect.arrayContaining([0, 0, 255, 255]));
    expect(hexToRGB('#FF0000', 128)).toEqual(expect.arrayContaining([255, 0, 0, 128]));
  });
});
