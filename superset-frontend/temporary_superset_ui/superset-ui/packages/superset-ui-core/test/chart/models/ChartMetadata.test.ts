import ChartMetadata from '@superset-ui/core/src/chart/models/ChartMetadata';

describe('ChartMetadata', () => {
  it('exists', () => {
    expect(ChartMetadata).toBeDefined();
  });
  describe('new ChartMetadata({})', () => {
    it('creates new metadata instance', () => {
      const metadata = new ChartMetadata({
        name: 'test chart',
        credits: [],
        description: 'some kind of chart',
        thumbnail: 'test.png',
      });
      expect(metadata).toBeInstanceOf(ChartMetadata);
    });
  });
  describe('.canBeAnnotationType(type)', () => {
    const metadata = new ChartMetadata({
      name: 'test chart',
      canBeAnnotationTypes: ['event'],
      credits: [],
      description: 'some kind of chart',
      thumbnail: 'test.png',
    });
    it('returns true if can', () => {
      expect(metadata.canBeAnnotationType('event')).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(metadata.canBeAnnotationType('invalid-type')).toBeFalsy();
    });
  });
  describe('.clone()', () => {
    const metadata = new ChartMetadata({
      name: 'test chart',
      canBeAnnotationTypes: ['event'],
      credits: [],
      description: 'some kind of chart',
      thumbnail: 'test.png',
    });
    const clone = metadata.clone();

    it('returns a new instance', () => {
      expect(metadata).not.toBe(clone);
    });
    it('returns a new instance with same field values', () => {
      expect(metadata.name).toEqual(clone.name);
      expect(metadata.credits).toEqual(clone.credits);
      expect(metadata.description).toEqual(clone.description);
      expect(metadata.canBeAnnotationTypes).toEqual(clone.canBeAnnotationTypes);
      expect(metadata.thumbnail).toEqual(clone.thumbnail);
    });
  });
});
