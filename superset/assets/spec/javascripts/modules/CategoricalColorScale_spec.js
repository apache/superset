import { it, describe } from 'mocha';
import { expect } from 'chai';
import CategoricalColorScale from '../../../src/modules/CategoricalColorScale';

describe('CategoricalColorScale', () => {
  it('exists', () => {
    expect(CategoricalColorScale !== undefined).to.equal(true);
  });

  describe('new CategoricalColorScale(colors, parentForcedColors)', () => {
    it('can create new scale when parentForcedColors is not given', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale).to.be.instanceOf(CategoricalColorScale);
    });
    it('can create new scale when parentForcedColors is given', () => {
      const parentForcedColors = {};
      const scale = new CategoricalColorScale(['blue', 'red', 'green'], parentForcedColors);
      expect(scale).to.be.instanceOf(CategoricalColorScale);
      expect(scale.parentForcedColors).to.equal(parentForcedColors);
    });
  });
  describe('.getColor(value)', () => {
    it('returns same color for same value', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const c1 = scale.getColor('pig');
      const c2 = scale.getColor('horse');
      const c3 = scale.getColor('pig');
      scale.getColor('cow');
      const c5 = scale.getColor('horse');

      expect(c1).to.equal(c3);
      expect(c2).to.equal(c5);
    });
    it('returns different color for consecutive items', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const c1 = scale.getColor('pig');
      const c2 = scale.getColor('horse');
      const c3 = scale.getColor('cat');

      expect(c1).to.not.equal(c2);
      expect(c2).to.not.equal(c3);
      expect(c3).to.not.equal(c1);
    });
    it('recycles colors when number of items exceed available colors', () => {
      const colorSet = {};
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const colors = [
        scale.getColor('pig'),
        scale.getColor('horse'),
        scale.getColor('cat'),
        scale.getColor('cow'),
        scale.getColor('donkey'),
        scale.getColor('goat'),
      ];
      colors.forEach((color) => {
        if (colorSet[color]) {
          colorSet[color]++;
        } else {
          colorSet[color] = 1;
        }
      });
      expect(Object.keys(colorSet).length).to.equal(3);
      ['blue', 'red', 'green'].forEach((color) => {
        expect(colorSet[color]).to.equal(2);
      });
    });
  });
  describe('.setColor(value, forcedColor)', () => {
    it('overrides default color', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.setColor('pig', 'pink');
      expect(scale.getColor('pig')).to.equal('pink');
    });
    it('does not override parentForcedColors', () => {
      const scale1 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale1.setColor('pig', 'black');
      const scale2 = new CategoricalColorScale(['blue', 'red', 'green'], scale1.forcedColors);
      scale2.setColor('pig', 'pink');
      expect(scale1.getColor('pig')).to.equal('black');
      expect(scale2.getColor('pig')).to.equal('black');
    });
    it('returns the scale', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const output = scale.setColor('pig', 'pink');
      expect(scale).to.equal(output);
    });
  });
  describe('.toFunction()', () => {
    it('returns a function that wraps getColor', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const colorFn = scale.toFunction();
      expect(scale.getColor('pig')).to.equal(colorFn('pig'));
      expect(scale.getColor('cat')).to.equal(colorFn('cat'));
    });
  });
});
