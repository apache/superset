import getBBoxCeil from '@superset-ui/core/src/dimension/svg/getBBoxCeil';
import createTextNode from '@superset-ui/core/src/dimension/svg/createTextNode';

describe('getBBoxCeil(node, defaultDimension)', () => {
  describe('returns default dimension if getBBox() is not available', () => {
    it('returns default value for default dimension', () => {
      expect(getBBoxCeil(createTextNode())).toEqual({
        height: 20,
        width: 100,
      });
    });
    it('return specified value if specified', () => {
      expect(
        getBBoxCeil(createTextNode(), {
          height: 30,
          width: 400,
        }),
      ).toEqual({
        height: 30,
        width: 400,
      });
    });
  });
  describe('returns ceiling of the svg element', () => {
    it('converts to ceiling if value is not integer', () => {
      expect(getBBoxCeil(createTextNode(), { height: 10.6, width: 11.1 })).toEqual({
        height: 11,
        width: 12,
      });
    });

    it('does nothing if value is integer', () => {
      expect(getBBoxCeil(createTextNode())).toEqual({
        height: 20,
        width: 100,
      });
    });
  });
});
