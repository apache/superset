import {
  ChartPlugin,
  ChartMetadata,
  FormData,
  DatasourceType,
  ChartProps,
  BuildQueryFunction,
  TransformPropsFunction,
} from '../../src';

describe('ChartPlugin', () => {
  const metadata = new ChartMetadata({
    name: 'test-chart',
    thumbnail: '',
  });

  it('exists', () => {
    expect(ChartPlugin).toBeDefined();
  });

  describe('new ChartPlugin()', () => {
    const FakeChart = () => 'test';
    const buildQuery = (formData: FormData) => ({
      datasource: { id: 1, type: DatasourceType.Table },
      queries: [{ granularity: 'day' }],
    });
    const FORM_DATA = {
      datasource: '1__table',
      granularity: 'day',
      viz_type: 'table',
    };

    it('creates a new plugin', () => {
      const plugin = new ChartPlugin({
        metadata,
        Chart() {},
      });
      expect(plugin).toBeInstanceOf(ChartPlugin);
    });
    describe('buildQuery', () => {
      it('defaults to identity function', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        expect(plugin.loadBuildQuery).toBeUndefined();
      });
      it('uses loadBuildQuery field if specified', () => {
        expect.assertions(1);
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          loadBuildQuery: () => buildQuery,
        });
        if (typeof plugin.loadBuildQuery === 'function') {
          const fn = plugin.loadBuildQuery() as BuildQueryFunction;
          expect(fn(FORM_DATA).queries[0]).toEqual({ granularity: 'day' });
        }
      });
      it('uses buildQuery field if specified', () => {
        expect.assertions(1);
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          buildQuery,
        });
        if (typeof plugin.loadBuildQuery === 'function') {
          const fn = plugin.loadBuildQuery() as BuildQueryFunction;
          expect(fn(FORM_DATA).queries[0]).toEqual({ granularity: 'day' });
        }
      });
    });
    describe('Chart', () => {
      it('uses loadChart if specified', () => {
        const loadChart = () => FakeChart;
        const plugin = new ChartPlugin({
          metadata,
          loadChart,
        });
        expect(plugin.loadChart).toBe(loadChart);
      });
      it('uses Chart field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        expect(plugin.loadChart()).toEqual(FakeChart);
      });
      it('throws an error if none of Chart or loadChart is specified', () => {
        expect(() => new ChartPlugin({ metadata })).toThrowError(Error);
      });
    });
    describe('transformProps', () => {
      const PROPS = new ChartProps({
        formData: FORM_DATA,
        width: 400,
        height: 400,
        payload: {},
      });
      it('defaults to identity function', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
        });
        const fn = plugin.loadTransformProps() as TransformPropsFunction;
        expect(fn(PROPS)).toBe(PROPS);
      });
      it('uses loadTransformProps field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          loadTransformProps: () => () => ({ field2: 2 }),
        });
        const fn = plugin.loadTransformProps() as TransformPropsFunction;
        expect(fn(PROPS)).toEqual({ field2: 2 });
      });
      it('uses transformProps field if specified', () => {
        const plugin = new ChartPlugin({
          metadata,
          Chart: FakeChart,
          transformProps: () => ({ field2: 2 }),
        });
        const fn = plugin.loadTransformProps() as TransformPropsFunction;
        expect(fn(PROPS)).toEqual({ field2: 2 });
      });
    });
  });

  describe('.register()', () => {
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
