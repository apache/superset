import { it, describe } from 'mocha';
import { expect } from 'chai';

import { ALL_COLOR_SCHEMES, getColorFromScheme, hexToRGB } from '../../../javascripts/modules/colors';

describe('colors', () => {
  it('default to bnbColors', () => {
    const color1 = getColorFromScheme('CA');
    expect(color1).to.equal(ALL_COLOR_SCHEMES.bnbColors[0]);
  });
  it('series with same scheme should have the same color', () => {
    const color1 = getColorFromScheme('CA', 'bnbColors');
    const color2 = getColorFromScheme('CA', 'googleCategory20c');
    const color3 = getColorFromScheme('CA', 'bnbColors');
    const color4 = getColorFromScheme('NY', 'bnbColors');

    expect(color1).to.equal(ALL_COLOR_SCHEMES.bnbColors[0]);
    expect(color2).to.equal(ALL_COLOR_SCHEMES.googleCategory20c[0]);
    expect(color1).to.equal(color3);
    expect(color4).to.equal(ALL_COLOR_SCHEMES.bnbColors[1]);
  });

  it('hexToRGB converts properly', () => {
    expect(hexToRGB('#FFFFFF')).to.have.same.members([255, 255, 255, 255]);
    expect(hexToRGB('#000000')).to.have.same.members([0, 0, 0, 255]);
    expect(hexToRGB('#FF0000')).to.have.same.members([255, 0, 0, 255]);
    expect(hexToRGB('#00FF00')).to.have.same.members([0, 255, 0, 255]);
    expect(hexToRGB('#0000FF')).to.have.same.members([0, 0, 255, 255]);
    expect(hexToRGB('#FF0000', 128)).to.have.same.members([255, 0, 0, 128]);
  });
});
