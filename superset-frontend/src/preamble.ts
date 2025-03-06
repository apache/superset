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
import 'abortcontroller-polyfill/dist/abortcontroller-polyfill-only';
import dayjs from 'dayjs';
// eslint-disable-next-line no-restricted-imports
import {
  configure,
  makeApi,
  supersetTheme,
  initFeatureFlags,
} from '@superset-ui/core';
import { merge } from 'lodash';
import setupClient from './setup/setupClient';
import setupColors from './setup/setupColors';
import setupFormatters from './setup/setupFormatters';
import setupDashboardComponents from './setup/setupDashboardComponents';
import { User } from './types/bootstrapTypes';
import getBootstrapData from './utils/getBootstrapData';

if (process.env.WEBPACK_MODE === 'development') {
  setHotLoaderConfig({ logLevel: 'debug', trackTailUpdates: false });
}

// eslint-disable-next-line import/no-mutable-exports
const bootstrapData = getBootstrapData();

// Configure translation
if (typeof window !== 'undefined') {
  configure({ languagePack: bootstrapData.common.language_pack });
  dayjs.locale(bootstrapData.common.locale);
} else {
  configure();
}

// Configure feature flags
initFeatureFlags(bootstrapData.common.feature_flags);

// Setup SupersetClient
setupClient();

setupColors(
  bootstrapData.common.extra_categorical_color_schemes,
  bootstrapData.common.extra_sequential_color_schemes,
);

// Setup number formatters
setupFormatters(
  bootstrapData.common.d3_format,
  bootstrapData.common.d3_time_format,
);

setupDashboardComponents();

export const theme = merge(
  supersetTheme,
  bootstrapData.common.theme_overrides ?? {},
);

const getMe = makeApi<void, User>({
  method: 'GET',
  endpoint: '/api/v1/me/',
});

/**
 * When you re-open the window, we check if you are still logged in.
 * If your session expired or you signed out, we'll redirect to login.
 * If you aren't logged in in the first place (!isActive), then we shouldn't do this.
 */
if (bootstrapData.user?.isActive) {
  document.addEventListener('visibilitychange', () => {
    // we only care about the tab becoming visible, not vice versa
    if (document.visibilityState !== 'visible') return;

    getMe().catch(() => {
      // ignore error, SupersetClient will redirect to login on a 401
    });
  });
}
