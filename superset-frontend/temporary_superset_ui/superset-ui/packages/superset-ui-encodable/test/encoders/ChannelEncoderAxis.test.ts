import { ChannelEncoder } from '../../src';

describe('ChannelEncoderAxis', () => {
  describe('new ChannelEncoderAxis(channelEncoder)', () => {
    it('completes the definition and creates an encoder for it', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.axis).toBeDefined();
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
          axis: {
            format: '.2f',
          },
        },
      });
      expect(encoder.axis && encoder.axis.formatValue(200)).toEqual('200.00');
    });
    it('fallsback to field formatter', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          format: '.3f',
        },
      });
      expect(encoder.axis && encoder.axis.formatValue(200)).toEqual('200.000');
    });
    it('fallsback to default formatter', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.axis && encoder.axis.formatValue(200)).toEqual('200');
    });
  });

  describe('.getTitle()', () => {
    it('returns the axis title', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
          axis: {
            title: 'Speed!',
          },
        },
      });
      expect(encoder.axis && encoder.axis.getTitle()).toEqual('Speed!');
    });
    it('returns the field title when not specified', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
        },
      });
      expect(encoder.axis && encoder.axis.getTitle()).toEqual('Speed');
    });
    it('returns the field name when no title is specified', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
        },
      });
      expect(encoder.axis && encoder.axis.getTitle()).toEqual('speed');
    });
  });

  describe('.hasTitle()', () => {
    it('returns true if the title is not empty', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
          axis: {
            title: 'Speed!',
          },
        },
      });
      expect(encoder.axis && encoder.axis.hasTitle()).toBeTruthy();
    });
    it('returns false otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          title: 'Speed',
          axis: {
            title: '',
          },
        },
      });
      expect(encoder.axis && encoder.axis.hasTitle()).toBeFalsy();
    });
  });

  describe('.getTickLabels()', () => {
    it('handles hard-coded tick values', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          axis: {
            values: [1, 2, 3],
          },
        },
      });
      expect(encoder.axis && encoder.axis.getTickLabels()).toEqual(['1', '2', '3']);
    });
    it('handles hard-coded DateTime object', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'temporal',
          field: 'time',
          axis: {
            format: '%Y',
            values: [{ year: 2018 }, { year: 2019 }],
          },
        },
      });
      expect(encoder.axis && encoder.axis.getTickLabels()).toEqual(['2018', '2019']);
    });
    describe('uses information from scale', () => {
      it('uses ticks when available', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'quantitative',
            field: 'speed',
            scale: {
              type: 'linear',
              domain: [0, 100],
            },
            axis: {
              tickCount: 5,
            },
          },
        });
        expect(encoder.axis && encoder.axis.getTickLabels()).toEqual([
          '0',
          '20',
          '40',
          '60',
          '80',
          '100',
        ]);
      });
      it('or uses domain', () => {
        const encoder = new ChannelEncoder({
          name: 'x',
          channelType: 'X',
          definition: {
            type: 'nominal',
            field: 'brand',
            scale: {
              domain: ['honda', 'toyota'],
            },
          },
        });
        expect(encoder.axis && encoder.axis.getTickLabels()).toEqual(['honda', 'toyota']);
      });
    });
    it('returns empty array otherwise', () => {
      const encoder = new ChannelEncoder({
        name: 'x',
        channelType: 'X',
        definition: {
          type: 'quantitative',
          field: 'speed',
          scale: false,
        },
      });
      expect(encoder.axis && encoder.axis.getTickLabels()).toEqual([]);
    });
  });
});
