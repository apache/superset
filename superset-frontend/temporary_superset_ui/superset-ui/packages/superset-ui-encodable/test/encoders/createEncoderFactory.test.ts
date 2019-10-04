import createEncoderFactory from '../../src/encoders/createEncoderFactory';

describe('createEncoderFactory()', () => {
  it('supports defaultEncoding as fixed value', () => {
    const factory = createEncoderFactory<{
      x: ['X', number];
    }>({
      channelTypes: {
        x: 'X',
      },
      defaultEncoding: {
        x: { type: 'quantitative', field: 'speed' },
      },
    });

    const encoder = factory.create();
    expect(encoder.encoding).toEqual({
      x: { type: 'quantitative', field: 'speed' },
    });
  });
  it('supports completeEncoding for customization', () => {
    const factory = createEncoderFactory<{
      color: ['Color', string];
    }>({
      channelTypes: {
        color: 'Color',
      },
      completeEncoding: () => ({
        color: { value: 'red' },
      }),
    });

    const encoder = factory.create();
    expect(encoder.encoding).toEqual({
      color: { value: 'red' },
    });
  });
});
