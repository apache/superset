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

    });
    it('replaces the default config with given config when replace is true', () => {

    });
    it('returns the plugin itself', () => {

    });
  });

  describe('.resetConfig()', () => {
    it('resets config back to default', () => {

    });
    it('returns the plugin itself', () => {

    });
  });
});
