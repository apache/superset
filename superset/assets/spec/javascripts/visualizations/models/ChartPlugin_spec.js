import { describe, it } from 'mocha';
import { expect } from 'chai';
import ChartPlugin from '../../../../src/visualizations/core/models/ChartPlugin';
import ChartMetadata from '../../../../src/visualizations/core/models/ChartMetadata';

describe('ChartPlugin', () => {
  const metadata = new ChartMetadata({});

  it('exists', () => {
    expect(ChartPlugin).to.not.equal(undefined);
  });

  describe('new ChartPlugin()', () => {
    it('creates a new plugin', () => {
      const plugin = new ChartPlugin({
        metadata,
        Chart() {},
      });
      expect(plugin).to.be.instanceof(ChartPlugin);
    });
    it('throws an error if metadata is not specified', () => {
      expect(() => new ChartPlugin()).to.throw(Error);
    });
    it('throws an error if none of Chart or loadChart is specified', () => {
      expect(() => new ChartPlugin({ metadata })).to.throw(Error);
    });
  });

  describe('.register(key)', () => {
    const plugin = new ChartPlugin({
      metadata,
      Chart() {},
    });
    it('throws an error if key is not provided', () => {
      expect(() => plugin.register()).to.throw(Error);
      expect(() => plugin.configure({ key: 'abc' }).register()).to.not.throw(Error);
    });
    it('returns itself', () => {
      expect(plugin.configure({ key: 'abc' }).register()).to.equal(plugin);
    });
  });
});
