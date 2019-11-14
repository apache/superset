import { CategoricalColorScale } from '@superset-ui/color';
import { scaleLinear, scaleOrdinal, scaleTime, scaleLog } from 'd3-scale';
import {
  isD3Scale,
  isCategoricalColorScale,
  isTimeScale,
  isContinuousScaleConfig,
  isScaleConfigWithZero,
  isContinuousScale,
} from '../../src/typeGuards/Scale';
import { HasToString } from '../../src/types/Base';

describe('type guards', () => {
  describe('isContinuousScaleConfig(scaleConfig)', () => {
    it('returns true if continuous', () => {
      expect(isContinuousScaleConfig({ type: 'linear' })).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isContinuousScaleConfig({ type: 'point' })).toBeFalsy();
    });
  });
  describe('isScaleConfigWithZero(scaleConfig)', () => {
    it('returns true if support zero', () => {
      expect(isScaleConfigWithZero({ type: 'linear' })).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isScaleConfigWithZero({ type: 'log' })).toBeFalsy();
    });
  });
  describe('isD3Scale(scale)', () => {
    it('returns true if it is one of D3 scales', () => {
      expect(isD3Scale(scaleLinear())).toBeTruthy();
      expect(isD3Scale(scaleOrdinal<HasToString, string>())).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isD3Scale(new CategoricalColorScale(['red', 'yellow']))).toBeFalsy();
    });
  });
  describe('isCategoricalColorScale(scale)', () => {
    it('returns true if it is CategoricalColorScale', () => {
      expect(isCategoricalColorScale(new CategoricalColorScale(['red', 'yellow']))).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isCategoricalColorScale(scaleLinear())).toBeFalsy();
    });
  });
  describe('isContinuousScale(scale, type)', () => {
    it('returns true if type is one of the time scale types', () => {
      expect(isContinuousScale(scaleLinear(), 'linear')).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isContinuousScale(scaleOrdinal<HasToString, string>(), 'ordinal')).toBeFalsy();
    });
  });
  describe('isTimeScale(scale, type)', () => {
    it('returns true if type is one of the time scale types', () => {
      expect(isTimeScale(scaleTime(), 'time')).toBeTruthy();
      expect(isTimeScale(scaleTime(), 'utc')).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(isTimeScale(scaleLinear(), 'linear')).toBeFalsy();
      expect(isTimeScale(scaleLog(), 'log')).toBeFalsy();
    });
  });
});
