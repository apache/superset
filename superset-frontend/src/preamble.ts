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
import { setConfig as setHotLoaderConfig } from 'react-hot-loader';
import dayjs from 'dayjs';
// eslint-disable-next-line no-restricted-imports
import {
  configure,
  makeApi,
  initFeatureFlags,
  SupersetClient,
  LanguagePack,
} from '@superset-ui/core';
import setupClient from './setup/setupClient';
import setupColors from './setup/setupColors';
import setupFormatters from './setup/setupFormatters';
import setupDashboardComponents from './setup/setupDashboardComponents';
import { User } from './types/bootstrapTypes';
import getBootstrapData, { applicationRoot } from './utils/getBootstrapData';
import './hooks/useLocale';

configure();

// Set hot reloader config
if (process.env.WEBPACK_MODE === 'development') {
  setHotLoaderConfig({ logLevel: 'debug', trackTailUpdates: false });
}

// Grab initial bootstrap data
const bootstrapData = getBootstrapData();

setupFormatters(
  bootstrapData.common.d3_format,
  bootstrapData.common.d3_time_format,
);

// Setup SupersetClient early so we can fetch language pack
setupClient({ appRoot: applicationRoot() });

// Load language pack before anything else
(async () => {
  const lang = bootstrapData.common.locale || 'en';
  if (lang !== 'en') {
    try {
      // Second call to configure to set the language pack
      const { json } = await SupersetClient.get({
        endpoint: `/superset/language_pack/${lang}/`,
      });
      configure({ languagePack: json as LanguagePack });
      dayjs.locale(lang);
    } catch (err) {
      console.warn(
        'Failed to fetch language pack, falling back to default.',
        err,
      );
      configure();
      dayjs.locale('en');
    }
  }

  // Continue with rest of setup
  initFeatureFlags(bootstrapData.common.feature_flags);

  setupColors(
    bootstrapData.common.extra_categorical_color_schemes,
    bootstrapData.common.extra_sequential_color_schemes,
  );

  setupDashboardComponents();

  const getMe = makeApi<void, User>({
    method: 'GET',
    endpoint: '/api/v1/me/',
  });

  if (bootstrapData.user?.isActive) {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        getMe().catch(() => {
          // SupersetClient will redirect to login on 401
        });
      }
    });
  }
})();
