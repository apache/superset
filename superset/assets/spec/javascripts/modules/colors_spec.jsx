import { expect } from 'chai';
import { hexToRGB } from '../../../src/modules/colors';

describe('colors', () => {
  it('hexToRGB converts properly', () => {
    expect(hexToRGB('#FFFFFF')).to.have.same.members([255, 255, 255, 255]);
    expect(hexToRGB('#000000')).to.have.same.members([0, 0, 0, 255]);
    expect(hexToRGB('#FF0000')).to.have.same.members([255, 0, 0, 255]);
    expect(hexToRGB('#00FF00')).to.have.same.members([0, 255, 0, 255]);
    expect(hexToRGB('#0000FF')).to.have.same.members([0, 0, 255, 255]);
    expect(hexToRGB('#FF0000', 128)).to.have.same.members([255, 0, 0, 128]);
  });
});
