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

import { DEFAULT_BOOTSTRAP_DATA } from '../constants';

describe('getBootstrapData and helpers', () => {
  afterEach(() => {
    // Clean up the DOM
    document.body.innerHTML = '';
  });

  describe('getBootstrapData()', () => {
    it('should return DEFAULT_BOOTSTRAP_DATA when #app element does not exist', async () => {
      // Ensure no #app element exists.
      document.body.innerHTML = '';

      // Reset module to clear cachedBootstrapData
      jest.resetModules();
      const { default: getBootstrapData } = await import('./getBootstrapData');
      const bootstrapData = getBootstrapData();
      expect(bootstrapData).toEqual(DEFAULT_BOOTSTRAP_DATA);
    });

    it('should return parsed bootstrap data when #app element has valid data attribute', async () => {
      // Set up the fake #app element
      const customData = {
        common: {
          application_root: '/custom-app/',
          static_assets_prefix: '/custom-static/',
        },
      };
      document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;

      // Reset modules and re-import the module so that cachedBootstrapData is clear.
      jest.resetModules();
      const { default: getBootstrapData } = await import('./getBootstrapData');
      const bootstrapData = getBootstrapData();
      expect(bootstrapData).toEqual(customData);
    });
  });

  describe('Helper functions applicationRoot and staticAssetsPrefix', () => {
    it('should return values without trailing slashes', async () => {
      // Setup a fake #app element with data-bootstrap attribute.
      const customData = {
        common: {
          application_root: '/custom-app/',
          static_assets_prefix: '/custom-static/',
        },
      };
      document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;

      // Reset modules and re-import the module so that cachedBootstrapData is clear.
      jest.resetModules();
      const {
        default: getBootstrapData,
        applicationRoot,
        staticAssetsPrefix,
      } = await import('./getBootstrapData');

      // Call getBootstrapData to ensure caching is done.
      getBootstrapData();

      // The helpers should remove the trailing slash.
      expect(applicationRoot()).toEqual('/custom-app');
      expect(staticAssetsPrefix()).toEqual('/custom-static');
    });

    it('should return defaults without trailing slashes when #app element is missing', async () => {
      // Ensure no #app element exists.
      document.body.innerHTML = '';

      // Reset module to clear cachedBootstrapData and re-run computed values.
      jest.resetModules();
      const {
        default: getBootstrapData,
        applicationRoot,
        staticAssetsPrefix,
      } = await import('./getBootstrapData');

      // Call getBootstrapData to ensure caching is done.
      getBootstrapData();

      // Defaults from DEFAULT_BOOTSTRAP_DATA with trailing slashes removed.
      const expectedAppRoot =
        DEFAULT_BOOTSTRAP_DATA.common.application_root.replace(/\/$/, '');
      const expectedStaticPrefix =
        DEFAULT_BOOTSTRAP_DATA.common.static_assets_prefix.replace(/\/$/, '');

      expect(applicationRoot()).toEqual(expectedAppRoot);
      expect(staticAssetsPrefix()).toEqual(expectedStaticPrefix);
    });

    it('should defaults without trailing slashes when #app element does not include application_root or static_assets_prefix', async () => {
      // Set up the fake #app element
      const customData = {
        common: {
          my_custom_property: 'custom-value',
        },
      };
      document.body.innerHTML = `<div id="app" data-bootstrap='${JSON.stringify(customData)}'></div>`;

      // Reset modules and re-import the module so that cachedBootstrapData is clear.
      jest.resetModules();
      const {
        default: getBootstrapData,
        applicationRoot,
        staticAssetsPrefix,
      } = await import('./getBootstrapData');
      const bootstrapData = getBootstrapData();
      expect(bootstrapData).toEqual(customData);
      const expectedAppRoot =
        DEFAULT_BOOTSTRAP_DATA.common.application_root.replace(/\/$/, '');
      const expectedStaticPrefix =
        DEFAULT_BOOTSTRAP_DATA.common.static_assets_prefix.replace(/\/$/, '');

      expect(applicationRoot()).toEqual(expectedAppRoot);
      expect(staticAssetsPrefix()).toEqual(expectedStaticPrefix);
    });
  });
});
