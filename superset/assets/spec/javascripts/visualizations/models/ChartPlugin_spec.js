import ChartPlugin from '../../../../src/visualizations/core/models/ChartPlugin';
import ChartMetadata from '../../../../src/visualizations/core/models/ChartMetadata';

describe('ChartPlugin', () => {
  const metadata = new ChartMetadata({});

  test('exists', () => {
    expect(ChartPlugin).toBeDefined();
  });

  describe('new ChartPlugin()', () => {
    test('creates a new plugin', () => {
      const plugin = new ChartPlugin({
        metadata,
        Chart() {},
      });
      expect(plugin).toBeInstanceOf(ChartPlugin);
    });
    test('throws an error if metadata is not specified', () => {
      expect(() => new ChartPlugin()).toThrowError(Error);
    });
    test('throws an error if none of Chart or loadChart is specified', () => {
      expect(() => new ChartPlugin({ metadata })).toThrowError(Error);
    });
  });

  describe('.register(key)', () => {
    const plugin = new ChartPlugin({
      metadata,
      Chart() {},
    });
    test('throws an error if key is not provided', () => {
      expect(() => plugin.register()).toThrowError(Error);
      expect(() => plugin.configure({ key: 'abc' }).register()).not.toThrowError(Error);
    });
    test('returns itself', () => {
      expect(plugin.configure({ key: 'abc' }).register()).toBe(plugin);
    });
  });
});
