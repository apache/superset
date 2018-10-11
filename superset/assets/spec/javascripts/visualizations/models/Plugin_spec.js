import Plugin from '../../../../src/visualizations/core/models/Plugin';

describe('Plugin', () => {
  test('exists', () => {
    expect(Plugin).toBeDefined();
  });

  describe('new Plugin()', () => {
    test('creates a new plugin', () => {
      const plugin = new Plugin();
      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  describe('.configure(config, replace)', () => {
    test(
      'extends the default config with given config when replace is not set or false',
      () => {
        const plugin = new Plugin();
        plugin.configure({ key: 'abc', foo: 'bar' });
        plugin.configure({ key: 'def' });
        expect(plugin.config).toEqual({ key: 'def', foo: 'bar' });
      }
    );
    test(
      'replaces the default config with given config when replace is true',
      () => {
        const plugin = new Plugin();
        plugin.configure({ key: 'abc', foo: 'bar' });
        plugin.configure({ key: 'def' }, true);
        expect(plugin.config).toEqual({ key: 'def' });
      }
    );
    test('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.configure({ key: 'abc' })).toBe(plugin);
    });
  });

  describe('.resetConfig()', () => {
    test('resets config back to default', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.resetConfig();
      expect(plugin.config).toEqual({});
    });
    test('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.resetConfig()).toBe(plugin);
    });
  });
});
