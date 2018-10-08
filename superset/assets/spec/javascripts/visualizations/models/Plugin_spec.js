import { describe, it } from 'mocha';
import { expect } from 'chai';
import Plugin from '../../../../src/visualizations/core/models/Plugin';

describe('Plugin', () => {
  it('exists', () => {
    expect(Plugin).to.not.equal(undefined);
  });

  describe('new Plugin()', () => {
    it('creates a new plugin', () => {
      const plugin = new Plugin();
      expect(plugin).to.be.instanceof(Plugin);
    });
  });

  describe('.configure(config, replace)', () => {
    it('extends the default config with given config when replace is not set or false', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.configure({ key: 'def' });
      expect(plugin.config).to.deep.equal({ key: 'def', foo: 'bar' });
    });
    it('replaces the default config with given config when replace is true', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.configure({ key: 'def' }, true);
      expect(plugin.config).to.deep.equal({ key: 'def' });
    });
    it('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.configure({ key: 'abc' })).to.equal(plugin);
    });
  });

  describe('.resetConfig()', () => {
    it('resets config back to default', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.resetConfig();
      expect(plugin.config).to.deep.equal({});
    });
    it('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.resetConfig()).to.equal(plugin);
    });
  });
});
