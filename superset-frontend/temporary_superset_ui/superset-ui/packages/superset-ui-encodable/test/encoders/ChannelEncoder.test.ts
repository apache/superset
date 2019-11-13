import { ChannelEncoder } from '../../src';

describe('ChannelEncoder', () => {
  describe('new ChannelEncoder({ name, channelType, definition })', () => {
    it('completes the definition and creates an encoder for it', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder).toBeDefined();
      expect(encoder.definition.scale !== false && encoder.definition.scale.type).toEqual('linear');
    });
    it('creates a new encoder without scale', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          value: 1,
        },
      });
      expect(encoder).toBeDefined();
    });
  });

  describe('.encodeDatum()', () => {
    const encoder = new ChannelEncoder({
      name: 'x',
      channelType: 'X',
      definition: {
        type: 'quantitative',
        field: 'speed',
        title: 'Speed',
        scale: {
          domain: [0, 100],
          range: [0, 1],
        },
      },
    });
    it('encodes value from datum', () => {
      expect(encoder.encodeDatum({ speed: 100 })).toEqual(1);
    });
    it('returns fallback value if value is null or undefined', () => {
      expect(encoder.encodeDatum({ speed: null }, 20)).toEqual(20);
      expect(encoder.encodeDatum({}, 20)).toEqual(20);
    });
  });

  describe('.encodeValue()', () => {
    const encoder = new ChannelEncoder({
      name: 'x',
      channelType: 'X',
      definition: {
        type: 'quantitative',
        field: 'speed',
        title: 'Speed',
        scale: {
          domain: [0, 100],
          range: [0, 1],
        },
      },
    });
    it('encodes value', () => {
      expect(encoder.encodeValue(20)).toEqual(0.2);
    });
  });

  describe('.formatDatum()', () => {
    it('formats value from datum', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
        },
      });
      expect(encoder.formatDatum({ speed: 100000 })).toEqual('100k');
    });
  });

  describe('.formatValue()', () => {
    it('formats value', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
        },
      });
      expect(encoder.formatValue(100000)).toEqual('100k');
    });
  });

  describe('.getValueFromDatum()', () => {
    const encoder = new ChannelEncoder({
      name: 'x',
      channelType: 'X',
      definition: {
        type: 'quantitative',
        field: 'speed',
        title: 'Speed',
      },
    });
    it('returns value', () => {
      expect(encoder.getValueFromDatum({ speed: 100 })).toEqual(100);
    });
    it('returns fallback value if value is null or undefined', () => {
      expect(encoder.getValueFromDatum({ speed: null }, 20)).toEqual(20);
      expect(encoder.getValueFromDatum({}, 20)).toEqual(20);
    });
  });

  describe('.getDomain()', () => {
    describe('for ValueDef', () => {
      it('returns an array of fixed value', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            value: 1,
          },
        });
        expect(encoder.getDomainFromDataset([])).toEqual([1]);
      });
    });

    describe('for nominal field', () => {
      it('returns all possible values', () => {
        const encoder = new ChannelEncoder({
          name: 'pieColor',
          channelType: 'Color',
          definition: {
            type: 'nominal',
            field: 'brand',
          },
        });
        expect(
          encoder.getDomainFromDataset([{ brand: 'Forever 31' }, { brand: 'Super Wet' }]),
        ).toEqual(['Forever 31', 'Super Wet']);
      });
    });

    describe('for ordinal field', () => {
      it('returns all possible values', () => {
        const encoder = new ChannelEncoder({
          name: 'pieColor',
          channelType: 'Color',
          definition: {
            type: 'ordinal',
            field: 'size',
          },
        });
        expect(encoder.getDomainFromDataset([{ size: 'L' }, { size: 'XXL' }])).toEqual([
          'L',
          'XXL',
        ]);
      });
    });

    describe('for quantitative field', () => {
      it('returns min/max values', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'quantitative',
            field: 'price',
          },
        });
        expect(encoder.getDomainFromDataset([{ price: 1 }, { price: 5 }])).toEqual([1, 5]);
      });
      it('returns [0, 1] when cannot determine', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'quantitative',
            field: 'price',
          },
        });
        expect(encoder.getDomainFromDataset([{}, {}])).toEqual([0, 1]);
      });
    });

    describe('for temporal field', () => {
      it('returns min/max values', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'temporal',
            field: 'time',
          },
        });
        expect(
          encoder.getDomainFromDataset([
            { time: new Date(Date.UTC(2019, 1, 1)) },
            { time: new Date(Date.UTC(2019, 2, 1)) },
          ]),
        ).toEqual([new Date(Date.UTC(2019, 1, 1)), new Date(Date.UTC(2019, 2, 1))]);
      });
      it('returns [0, 1] when cannot determine', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'temporal',
            field: 'time',
          },
        });
        expect(encoder.getDomainFromDataset([{}, {}])).toEqual([0, 1]);
      });
    });

    it('returns empty array otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'geojson',
          field: 'time',
        },
      });
      expect(encoder.getDomainFromDataset([{}, {}])).toEqual([]);
    });
  });

  describe('.getTitle()', () => {
    it('returns title', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
        },
      });
      expect(encoder.getTitle()).toEqual('Speed');
    });
  });

  describe('.isGroupBy()', () => {
    it('returns true if the field of this channel is considered a group by clause', () => {
      expect(
        new ChannelEncoder({
          name: 'bubbleColor',
          channelType: 'Color',
          definition: {
            type: 'nominal',
            field: 'brand',
          },
        }).isGroupBy(),
      ).toBeTruthy();
      expect(
        new ChannelEncoder({
          name: 'bubbleColor',
          channelType: 'Color',
          definition: {
            type: 'ordinal',
            field: 'size',
          },
        }).isGroupBy(),
      ).toBeTruthy();
      expect(
        new ChannelEncoder({
          name: 'highlighted',
          channelType: 'Category',
          definition: {
            type: 'nominal',
            field: 'isLimitedEdition',
          },
        }).isGroupBy(),
      ).toBeTruthy();
      expect(
        new ChannelEncoder({
          name: 'tooltip',
          channelType: 'Text',
          definition: {
            type: 'nominal',
            field: 'description',
          },
        }).isGroupBy(),
      ).toBeTruthy();
      expect(
        new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'nominal',
            field: 'brand',
          },
        }).isGroupBy(),
      ).toBeTruthy();
      expect(
        new ChannelEncoder({
          name: 'y',
          channelType: 'Y',
          definition: {
            type: 'ordinal',
            field: 'size',
          },
        }).isGroupBy(),
      ).toBeTruthy();
    });
    it('returns false otherwise', () => {
      expect(
        new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'quantitative',
            field: 'speed',
          },
        }).isGroupBy(),
      ).toBeFalsy();
      expect(
        new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            value: 1,
          },
        }).isGroupBy(),
      ).toBeFalsy();
    });
  });

  describe('.isX()', () => {
    it('returns true if channel is Y', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.isX()).toBeTruthy();
    });
    it('returns false otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'y',
        channelType: 'Y',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.isX()).toBeFalsy();
    });
  });

  describe('.isY()', () => {
    it('returns true if channel is Y', () => {
      const encoder = new ChannelEncoder({
        name: 'y',
        channelType: 'Y',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.isY()).toBeTruthy();
    });
    it('returns false otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.isY()).toBeFalsy();
    });
  });

  describe('.isXOrY()', () => {
    it('returns true if channel is X or Y', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.isXOrY()).toBeTruthy();
    });
    it('returns false otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'bubbleColor',
        channelType: 'Color',
        definition: {
          type: 'nominal',
          field: 'brand',
        },
      });
      expect(encoder.isXOrY()).toBeFalsy();
    });
  });

  describe('.hasLegend()', () => {
    it('returns true if channel has a legend', () => {
      const encoder = new ChannelEncoder({
        name: 'bubbleColor',
        channelType: 'Color',
        definition: {
          type: 'nominal',
          field: 'brand',
        },
      });
      expect(encoder.hasLegend()).toBeTruthy();
    });
    it('returns false otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.hasLegend()).toBeFalsy();
    });
  });
});
