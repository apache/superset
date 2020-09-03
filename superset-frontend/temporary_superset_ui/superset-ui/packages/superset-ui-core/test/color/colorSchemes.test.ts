import categoricalAirbnb from '@superset-ui/core/src/color/colorSchemes/categorical/airbnb';
import categoricalEcharts from '@superset-ui/core/src/color/colorSchemes/categorical/echarts';
import categoricalSuperset from '@superset-ui/core/src/color/colorSchemes/categorical/superset';
import categoricalPreset from '@superset-ui/core/src/color/colorSchemes/categorical/preset';
import categoricalD3 from '@superset-ui/core/src/color/colorSchemes/categorical/d3';
import categoricalGoogle from '@superset-ui/core/src/color/colorSchemes/categorical/google';
import categoricalLyft from '@superset-ui/core/src/color/colorSchemes/categorical/lyft';
import sequentialCommon from '@superset-ui/core/src/color/colorSchemes/sequential/common';
import sequentialD3 from '@superset-ui/core/src/color/colorSchemes/sequential/d3';
import CategoricalScheme from '@superset-ui/core/src/color/CategoricalScheme';
import SequentialScheme from '@superset-ui/core/src/color/SequentialScheme';

describe('Color Schemes', () => {
  describe('categorical', () => {
    it('returns an array of CategoricalScheme', () => {
      [
        categoricalAirbnb,
        categoricalEcharts,
        categoricalD3,
        categoricalGoogle,
        categoricalLyft,
        categoricalSuperset,
        categoricalPreset,
      ].forEach(group => {
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
