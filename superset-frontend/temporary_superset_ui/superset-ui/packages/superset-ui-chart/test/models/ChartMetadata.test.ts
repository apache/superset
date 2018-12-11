import { ChartMetadata } from '../../src/models/ChartMetadata';

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
      credits: [],
      description: 'some kind of chart',
      canBeAnnotationTypes: ['event'],
      thumbnail: 'test.png',
    });
    it('returns true if can', () => {
      expect(metadata.canBeAnnotationType('event')).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(metadata.canBeAnnotationType('invalid-type')).toBeFalsy();
    });
  });
});
