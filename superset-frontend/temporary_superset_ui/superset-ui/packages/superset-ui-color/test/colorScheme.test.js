import categoricalAirbnb from '../src/colorSchemes/categorical/airbnb';
import categoricalD3 from '../src/colorSchemes/categorical/d3';
import categoricalGoogle from '../src/colorSchemes/categorical/google';
import categoricalLyft from '../src/colorSchemes/categorical/lyft';
import sequentialCommon from '../src/colorSchemes/sequential/common';
import sequentialD3 from '../src/colorSchemes/sequential/d3';
import CategoricalScheme from '../src/CategoricalScheme';
import SequentialScheme from '../src/SequentialScheme';

describe('Color Schemes', () => {
  describe('categorical', () => {
    it('returns an array of CategoricalScheme', () => {
      [categoricalAirbnb, categoricalD3, categoricalGoogle, categoricalLyft].forEach(group => {
        expect(group).toBeInstanceOf(Array);
        group.forEach(scheme => expect(scheme).toBeInstanceOf(CategoricalScheme));
      });
    });
  });
  describe('sequential', () => {
    it('returns an array of SequentialScheme', () => {
      [sequentialCommon, sequentialD3].forEach(group => {
        expect(group).toBeInstanceOf(Array);
        group.forEach(scheme => expect(scheme).toBeInstanceOf(SequentialScheme));
      });
    });
  });
});
