import createEncoderFactory from '../../src/encoders/createEncoderFactory';

describe('Encoder', () => {
  const factory = createEncoderFactory<{
    x: ['X', number];
    y: ['Y', number];
    color: ['Color', string];
    shape: ['Category', string];
    tooltip: ['Text', string, 'multiple'];
  }>({
    channelTypes: {
      x: 'X',
      y: 'Y',
      color: 'Color',
      shape: 'Category',
      tooltip: 'Text',
    },
    defaultEncoding: {
      x: { type: 'quantitative', field: 'speed' },
      y: { type: 'quantitative', field: 'price' },
      color: { type: 'nominal', field: 'brand' },
      shape: { type: 'nominal', field: 'brand' },
      tooltip: [{ field: 'make' }, { field: 'model' }],
    },
  });

  const encoder = factory.create();

  describe('new Encoder()', () => {
    it('creates new encoder', () => {
      expect(encoder).toBeDefined();
    });
  });
  describe('.getChannelNames()', () => {
    it('returns an array of channel names', () => {
      expect(encoder.getChannelNames()).toEqual(['x', 'y', 'color', 'shape', 'tooltip']);
    });
  });
  describe('.getChannelEncoders()', () => {
    it('returns an array of channel encoders', () => {
      expect(encoder.getChannelEncoders()).toHaveLength(5);
    });
  });
  describe('.getGroupBys()', () => {
    it('returns an array of groupby fields', () => {
      expect(encoder.getGroupBys()).toEqual(['brand', 'make', 'model']);
    });
  });
  describe('.hasLegend()', () => {
    it('returns true if has legend', () => {
      expect(encoder.hasLegend()).toBeTruthy();
    });
    it('returns false if does not have legend', () => {
      expect(
        factory
          .create({
            color: { type: 'nominal', field: 'brand', legend: false },
            shape: { value: 'diamond' },
          })
          .hasLegend(),
      ).toBeFalsy();
    });
  });
});
