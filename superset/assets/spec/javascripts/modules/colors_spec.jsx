import { hexToRGB } from '../../../src/modules/colors';

describe('hexToRGB', () => {
  it('is a function', () => {
    expect(typeof hexToRGB).toBe('function');
  });

  it('hexToRGB converts properly', () => {
    expect(hexToRGB('#FFFFFF')).toEqual(expect.arrayContaining([255, 255, 255, 255]));
    expect(hexToRGB('#000000')).toEqual(expect.arrayContaining([0, 0, 0, 255]));
    expect(hexToRGB('#FF0000')).toEqual(expect.arrayContaining([255, 0, 0, 255]));
    expect(hexToRGB('#00FF00')).toEqual(expect.arrayContaining([0, 255, 0, 255]));
    expect(hexToRGB('#0000FF')).toEqual(expect.arrayContaining([0, 0, 255, 255]));
  });

  it('works with falsy values', () => {
    expect(hexToRGB()).toEqual([0, 0, 0, 255]);
    /* eslint-disable quotes */
    [false, 0, -0, 0.0, '', "", ``, null, undefined, NaN].forEach((value) => {
      expect(hexToRGB(value)).toEqual(expect.arrayContaining([0, 0, 0, 255]));
    });
  });

  it('takes and alpha argument', () => {
    expect(hexToRGB('#FF0000', 128)).toEqual(expect.arrayContaining([255, 0, 0, 128]));
    expect(hexToRGB('#000000', 100)).toEqual(expect.arrayContaining([0, 0, 0, 100]));
    expect(hexToRGB('#ffffff', 0)).toEqual(expect.arrayContaining([255, 255, 255, 0]));
  });
});
