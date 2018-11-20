import ChartPlugin from '../../src/models/ChartPlugin';
import ChartMetadata from '../../src/models/ChartMetadata';

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
    describe('buildQuery', () => {
      const FORM_DATA = { field: 1 };
      it('defaults to identity function', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
        });
        expect(plugin.loadBuildQuery).toBeNull();
      });
      it('uses loadBuildQuery field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
          loadBuildQuery: () => () => ({ field2: 2 }),
        });
        expect(plugin.loadBuildQuery()(FORM_DATA)).toEqual({ field2: 2 });
      });
      it('uses buildQuery field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
          buildQuery: () => ({ field2: 2 }),
        });
        expect(plugin.loadBuildQuery()(FORM_DATA)).toEqual({ field2: 2 });
      });
    });
    describe('Chart', () => {
      it('uses loadChart if specified', () => {
        const loadChart = () => 'test';
        const plugin = new ChartPlugin({
          metadata,
          loadChart,
        });
        expect(plugin.loadChart).toBe(loadChart);
      });
      it('uses Chart field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
        });
        expect(plugin.loadChart()).toEqual('test');
      });
      it('throws an error if none of Chart or loadChart is specified', () => {
        expect(() => new ChartPlugin({ metadata })).toThrowError(Error);
      });
    });
    describe('transformProps', () => {
      const PROPS = { field: 1 };
      it('defaults to identity function', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
        });
        expect(plugin.loadTransformProps()(PROPS)).toBe(PROPS);
      });
      it('uses loadTransformProps field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
          loadTransformProps: () => () => ({ field2: 2 }),
        });
        expect(plugin.loadTransformProps()(PROPS)).toEqual({ field2: 2 });
      });
      it('uses transformProps field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: 'test',
          transformProps: () => ({ field2: 2 }),
        });
        expect(plugin.loadTransformProps()(PROPS)).toEqual({ field2: 2 });
      });
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
