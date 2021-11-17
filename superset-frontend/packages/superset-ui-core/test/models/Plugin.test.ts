/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { Plugin } from '@superset-ui/core/src';

describe('Plugin', () => {
  it('exists', () => {
    expect(Plugin).toBeDefined();
  });

  describe('new Plugin()', () => {
    it('creates a new plugin', () => {
      const plugin = new Plugin();
      expect(plugin).toBeInstanceOf(Plugin);
    });
  });

  describe('.configure(config, replace)', () => {
    it('extends the default config with given config when replace is not set or false', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.configure({ key: 'def' });
      expect(plugin.config).toEqual({ key: 'def', foo: 'bar' });
    });
    it('replaces the default config with given config when replace is true', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.configure({ key: 'def' }, true);
      expect(plugin.config).toEqual({ key: 'def' });
    });
    it('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.configure({ key: 'abc' })).toBe(plugin);
    });
  });

  describe('.resetConfig()', () => {
    it('resets config back to default', () => {
      const plugin = new Plugin();
      plugin.configure({ key: 'abc', foo: 'bar' });
      plugin.resetConfig();
      expect(plugin.config).toEqual({});
    });
    it('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.resetConfig()).toBe(plugin);
    });
  });

  describe('.register()', () => {
    it('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.register()).toBe(plugin);
    });
  });

  describe('.unregister()', () => {
    it('returns the plugin itself', () => {
      const plugin = new Plugin();
      expect(plugin.unregister()).toBe(plugin);
    });
  });
});
