import createEncoderFactory from '../../src/encoders/createEncoderFactory';

function stripFunction(legendInfo) {
  return legendInfo.map(legendGroup => {
    const { createLegendItems, channelEncoders, ...rest } = legendGroup;

    return { ...rest };
  });
}

describe('Encoder', () => {
  const factory = createEncoderFactory<{
    x: ['X', number];
    y: ['Y', number];
    color: ['Color', string];
    radius: ['Numeric', number];
    shape: ['Category', string];
    tooltip: ['Text', string, 'multiple'];
  }>({
    channelTypes: {
      x: 'X',
      y: 'Y',
      color: 'Color',
      radius: 'Numeric',
      shape: 'Category',
      tooltip: 'Text',
    },
    defaultEncoding: {
      x: { type: 'quantitative', field: 'speed' },
      y: { type: 'quantitative', field: 'price' },
      color: { type: 'nominal', field: 'brand' },
      radius: { value: 5 },
      shape: { value: 'circle' },
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
      expect(encoder.getChannelNames()).toEqual(['x', 'y', 'color', 'radius', 'shape', 'tooltip']);
    });
  });
  describe('.getChannelEncoders()', () => {
    it('returns an array of channel encoders', () => {
      expect(encoder.getChannelEncoders()).toHaveLength(6);
    });
  });
  describe('.getGroupBys()', () => {
    it('returns an array of groupby fields', () => {
      expect(encoder.getGroupBys()).toEqual(['brand', 'make', 'model']);
    });
  });
  describe('.getLegendInformation()', () => {
    it('returns information for each field', () => {
      const legendInfo = factory
        .create({
          color: { type: 'nominal', field: 'brand', scale: { range: ['red', 'green', 'blue'] } },
          shape: { type: 'nominal', field: 'brand', scale: { range: ['circle', 'diamond'] } },
        })
        .getLegendInformation([{ brand: 'Gucci' }, { brand: 'Prada' }]);

      expect(stripFunction(legendInfo)).toEqual([
        {
          field: 'brand',
          type: 'nominal',
          items: [
            {
              input: 'Gucci',
              output: {
                color: 'red',
                radius: 5,
                shape: 'circle',
              },
            },
            {
              input: 'Prada',
              output: {
                color: 'green',
                radius: 5,
                shape: 'diamond',
              },
            },
          ],
        },
      ]);
    });
    it('ignore channels that are ValueDef', () => {
      const legendInfo = factory
        .create({
          color: { type: 'nominal', field: 'brand', scale: { range: ['red', 'green', 'blue'] } },
        })
        .getLegendInformation([{ brand: 'Gucci' }, { brand: 'Prada' }]);

      expect(stripFunction(legendInfo)).toEqual([
        {
          field: 'brand',
          type: 'nominal',
          items: [
            {
              input: 'Gucci',
              output: {
                color: 'red',
                radius: 5,
                shape: 'circle',
              },
            },
            {
              input: 'Prada',
              output: {
                color: 'green',
                radius: 5,
                shape: 'circle',
              },
            },
          ],
        },
      ]);
    });
    it('for non-nominal fields, does not return items', () => {
      const legendInfo = factory
        .create({
          color: {
            type: 'quantitative',
            field: 'price',
            scale: { domain: [0, 20], range: ['#fff', '#f00'] },
          },
        })
        .getLegendInformation();

      expect(stripFunction(legendInfo)).toEqual([
        {
          field: 'price',
          type: 'quantitative',
        },
      ]);
    });
    it('for non-nominal fields, can use createLegendItems function', () => {
      const legendInfo = factory
        .create({
          color: {
            type: 'quantitative',
            field: 'price',
            scale: { domain: [0, 20], range: ['#fff', '#f00'] },
          },
          radius: {
            type: 'quantitative',
            field: 'price',
            scale: { domain: [0, 20], range: [0, 10] },
          },
        })
        .getLegendInformation();

      expect(legendInfo[0].createLegendItems([0, 10, 20])).toEqual([
        {
          input: 0,
          output: {
            color: 'rgb(255, 255, 255)',
            radius: 0,
            shape: 'circle',
          },
        },
        {
          input: 10,
          output: {
            color: 'rgb(255, 128, 128)',
            radius: 5,
            shape: 'circle',
          },
        },
        {
          input: 20,
          output: {
            color: 'rgb(255, 0, 0)',
            radius: 10,
            shape: 'circle',
          },
        },
      ]);
    });
    it('returns empty array if no legend', () => {
      const legendInfo = factory
        .create({
          color: { value: 'black' },
          shape: { value: 'square' },
        })
        .getLegendInformation([{ brand: 'Gucci' }, { brand: 'Prada' }]);

      expect(stripFunction(legendInfo)).toEqual([]);
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
