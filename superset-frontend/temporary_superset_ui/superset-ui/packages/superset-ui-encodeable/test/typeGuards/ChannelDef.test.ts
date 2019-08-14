import {
  isValueDef,
  isNonValueDef,
  isFieldDef,
  isTypedFieldDef,
  isScaleFieldDef,
  isPositionFieldDef,
} from '../../src/typeGuards/ChannelDef';

describe('type guards: ChannelDef', () => {
  describe('isValueDef()', () => {
    it('returns true if is ValueDef', () => {
      expect(isValueDef({ value: 'red' })).toBeTruthy();
    });
    it('return false otherwise', () => {
      expect(isValueDef({ field: 'horsepower' })).toBeFalsy();
    });
  });
  describe('isNonValueDef', () => {
    it('returns true if it is not a ValueDef', () => {
      expect(isNonValueDef({ field: 'horsepower' })).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isNonValueDef({ value: 'red' })).toBeFalsy();
    });
  });
  describe('isFieldDef', () => {
    it('returns true if is FieldDef', () => {
      expect(isFieldDef({ field: 'horsepower' })).toBeTruthy();
    });
    it('return false otherwise', () => {
      expect(isFieldDef({ value: 'red' })).toBeFalsy();
    });
  });
  describe('isTypedFieldDef', () => {
    it('returns true if is TypedFieldDef', () => {
      expect(isTypedFieldDef({ type: 'quantitative', field: 'horsepower' })).toBeTruthy();
    });
    it('return false otherwise', () => {
      expect(isTypedFieldDef({ value: 'red' })).toBeFalsy();
      expect(isTypedFieldDef({ field: 'make' })).toBeFalsy();
    });
  });
  describe('isScaleFieldDef', () => {
    it('returns true if is ScaleFieldDef', () => {
      expect(
        isScaleFieldDef({ type: 'nominal', field: 'horsepower', scale: { type: 'linear' } }),
      ).toBeTruthy();
    });
    it('return false otherwise', () => {
      expect(isScaleFieldDef({ value: 'red' })).toBeFalsy();
      expect(isScaleFieldDef({ field: 'make' })).toBeFalsy();
      expect(isScaleFieldDef({ type: 'quantitative', field: 'make' })).toBeFalsy();
    });
  });
  describe('isPositionFieldDef', () => {
    it('returns true if is ScaleFieldDef', () => {
      expect(
        isPositionFieldDef({
          type: 'nominal',
          field: 'horsepower',
          scale: { type: 'linear' },
          axis: { orient: 'bottom' },
        }),
      ).toBeTruthy();
    });
    it('return false otherwise', () => {
      expect(isPositionFieldDef({ value: 'red' })).toBeFalsy();
      expect(isPositionFieldDef({ field: 'make' })).toBeFalsy();
      expect(isPositionFieldDef({ type: 'quantitative', field: 'make' })).toBeFalsy();
      expect(
        isPositionFieldDef({ type: 'quantitative', field: 'make', scale: { type: 'quantile' } }),
      ).toBeFalsy();
    });
  });
});
