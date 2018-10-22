import CategoricalColorScale from '../../../../src/modules/colors/CategoricalColorScale';

describe('CategoricalColorScale', () => {
  it('exists', () => {
    expect(CategoricalColorScale !== undefined).toBe(true);
  });

  describe('new CategoricalColorScale(colors, parentForcedColors)', () => {
    it('can create new scale when parentForcedColors is not given', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      expect(scale).toBeInstanceOf(CategoricalColorScale);
    });
    it('can create new scale when parentForcedColors is given', () => {
      const parentForcedColors = {};
      const scale = new CategoricalColorScale(['blue', 'red', 'green'], parentForcedColors);
      expect(scale).toBeInstanceOf(CategoricalColorScale);
      expect(scale.parentForcedColors).toBe(parentForcedColors);
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

      expect(c1).toBe(c3);
      expect(c2).toBe(c5);
    });
    it('returns different color for consecutive items', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const c1 = scale.getColor('pig');
      const c2 = scale.getColor('horse');
      const c3 = scale.getColor('cat');

      expect(c1).not.toBe(c2);
      expect(c2).not.toBe(c3);
      expect(c3).not.toBe(c1);
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
      expect(Object.keys(colorSet)).toHaveLength(3);
      ['blue', 'red', 'green'].forEach((color) => {
        expect(colorSet[color]).toBe(2);
      });
    });
  });
  describe('.setColor(value, forcedColor)', () => {
    it('overrides default color', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      scale.setColor('pig', 'pink');
      expect(scale.getColor('pig')).toBe('pink');
    });
    it('does not override parentForcedColors', () => {
      const scale1 = new CategoricalColorScale(['blue', 'red', 'green']);
      scale1.setColor('pig', 'black');
      const scale2 = new CategoricalColorScale(['blue', 'red', 'green'], scale1.forcedColors);
      scale2.setColor('pig', 'pink');
      expect(scale1.getColor('pig')).toBe('black');
      expect(scale2.getColor('pig')).toBe('black');
    });
    it('returns the scale', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const output = scale.setColor('pig', 'pink');
      expect(scale).toBe(output);
    });
  });
  describe('.toFunction()', () => {
    it('returns a function that wraps getColor', () => {
      const scale = new CategoricalColorScale(['blue', 'red', 'green']);
      const colorFn = scale.toFunction();
      expect(scale.getColor('pig')).toBe(colorFn('pig'));
      expect(scale.getColor('cat')).toBe(colorFn('cat'));
    });
  });
});
