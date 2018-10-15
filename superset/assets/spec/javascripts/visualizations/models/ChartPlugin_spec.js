import ChartPlugin from '../../../../src/visualizations/core/models/ChartPlugin';
import ChartMetadata from '../../../../src/visualizations/core/models/ChartMetadata';

describe('ChartPlugin', () => {
  const metadata = new ChartMetadata({});

  it('exists', () => {
    expect(ChartPlugin).toBeDefined();
  });

  describe('new ChartPlugin()', () => {
    it('creates a new plugin', () => {
      const plugin = new ChartPlugin({
        metadata,
        Chart() {},
      });
      expect(plugin).toBeInstanceOf(ChartPlugin);
    });
    it('throws an error if metadata is not specified', () => {
      expect(() => new ChartPlugin()).toThrowError(Error);
    });
    it('throws an error if none of Chart or loadChart is specified', () => {
      expect(() => new ChartPlugin({ metadata })).toThrowError(Error);
    });
  });

  describe('.register(key)', () => {
    const plugin = new ChartPlugin({
      metadata,
      Chart() {},
    });
    it('throws an error if key is not provided', () => {
      expect(() => plugin.register()).toThrowError(Error);
      expect(() => plugin.configure({ key: 'abc' }).register()).not.toThrowError(Error);
    });
    it('returns itself', () => {
      expect(plugin.configure({ key: 'abc' }).register()).toBe(plugin);
    });
  });
});
