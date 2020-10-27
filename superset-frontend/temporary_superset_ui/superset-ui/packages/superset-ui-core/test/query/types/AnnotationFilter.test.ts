import {
  isEventAnnotationLayer,
  isFormulaAnnotationLayer,
  isIntervalAnnotationLayer,
  isTimeseriesAnnotationLayer,
} from '@superset-ui/core/src/query/types/AnnotationLayer';

describe('AnnotationLayer type guards', () => {
  describe('isFormulaAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isFormulaAnnotationLayer({
          annotationType: 'FORMULA',
          name: 'My Formula',
          value: 'sin(2*x)',
          style: 'solid',
          show: true,
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isFormulaAnnotationLayer({
          annotationType: 'EVENT',
          name: 'My Event',
          value: 1,
          style: 'solid',
          show: true,
        }),
      ).toEqual(false);
    });
  });

  describe('isEventAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isEventAnnotationLayer({
          annotationType: 'EVENT',
          name: 'My Event',
          value: 1,
          style: 'solid',
          show: true,
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isEventAnnotationLayer({
          annotationType: 'FORMULA',
          name: 'My Formula',
          value: 'sin(2*x)',
          style: 'solid',
          show: true,
        }),
      ).toEqual(false);
    });
  });

  describe('isIntervalAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isIntervalAnnotationLayer({
          annotationType: 'INTERVAL',
          name: 'My Event',
          value: 1,
          style: 'solid',
          show: true,
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isEventAnnotationLayer({
          annotationType: 'FORMULA',
          name: 'My Formula',
          value: 'sin(2*x)',
          style: 'solid',
          show: true,
        }),
      ).toEqual(false);
    });
  });

  describe('isTimeseriesAnnotationLayer', () => {
    it('should return true when it is the correct type', () => {
      expect(
        isTimeseriesAnnotationLayer({
          annotationType: 'TIME_SERIES',
          name: 'My Event',
          value: 1,
          style: 'solid',
          show: true,
        }),
      ).toEqual(true);
    });
    it('should return false otherwise', () => {
      expect(
        isTimeseriesAnnotationLayer({
          annotationType: 'FORMULA',
          name: 'My Formula',
          value: 'sin(2*x)',
          style: 'solid',
          show: true,
        }),
      ).toEqual(false);
    });
  });
});
