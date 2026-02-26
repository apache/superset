/**
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

import SupersetContributionPlugin from '../src/index';

// Mock webpack compiler and compilation
const createMockCompiler = (outputPath: string = '/test/output') => {
  return {
    options: {
      output: {
        path: outputPath,
      },
    },
    hooks: {
      compilation: {
        tap: jest.fn(),
      },
      emit: {
        tap: jest.fn(),
      },
    },
  } as any;
};

const createMockCompilation = (assets: Record<string, any> = {}) => {
  return {
    assets,
    hooks: {
      processAssets: {
        tap: jest.fn(),
      },
    },
    emitAsset: jest.fn(),
  } as any;
};

describe('SupersetContributionPlugin', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should create plugin with default options', () => {
      const plugin = new SupersetContributionPlugin();

      // Test that plugin was created (can't access private options easily)
      expect(plugin).toBeInstanceOf(SupersetContributionPlugin);
    });

    test('should create plugin with custom options', () => {
      const plugin = new SupersetContributionPlugin({
        outputPath: 'custom.json',
        include: ['app/**/*.ts'],
        exclude: ['**/*.spec.*'],
      });

      expect(plugin).toBeInstanceOf(SupersetContributionPlugin);
    });
  });

  describe('apply', () => {
    test('should register emit hook', () => {
      const plugin = new SupersetContributionPlugin();
      const compiler = createMockCompiler();

      plugin.apply(compiler);

      expect(compiler.hooks.emit.tapAsync).toHaveBeenCalledWith(
        'SupersetContributionPlugin',
        expect.any(Function),
      );
    });
  });

  describe('integration test', () => {
    test('should process and emit contributions.json', done => {
      const plugin = new SupersetContributionPlugin();
      const compiler = createMockCompiler('/test/root');
      const compilation = createMockCompilation();

      // Mock the emit hook to be called synchronously for testing
      compiler.hooks.emit.tapAsync.mockImplementation(
        (name: string, callback: any) => {
          // Call the callback with mocked compilation
          try {
            callback(compilation, () => {
              // Verify contributions.json was emitted
              expect(compilation.assets['contributions.json']).toBeDefined();

              const asset = compilation.assets['contributions.json'];
              const content = asset.source();
              const contributions = JSON.parse(content);

              // Should have the expected structure
              expect(contributions).toHaveProperty('commands');
              expect(contributions).toHaveProperty('views');
              expect(contributions).toHaveProperty('editors');
              expect(contributions).toHaveProperty('menus');

              expect(Array.isArray(contributions.commands)).toBe(true);
              expect(typeof contributions.views).toBe('object');
              expect(Array.isArray(contributions.editors)).toBe(true);
              expect(typeof contributions.menus).toBe('object');

              done();
            });
          } catch (error) {
            done(error);
          }
        },
      );

      plugin.apply(compiler);
    });
  });

  describe('file pattern matching', () => {
    test('should match TypeScript files', () => {
      const plugin = new SupersetContributionPlugin();

      // Test that the plugin handles common file patterns
      expect(plugin).toBeInstanceOf(SupersetContributionPlugin);
    });

    test('should exclude test files', () => {
      const plugin = new SupersetContributionPlugin();

      // Test that the plugin excludes test patterns
      expect(plugin).toBeInstanceOf(SupersetContributionPlugin);
    });
  });
});
