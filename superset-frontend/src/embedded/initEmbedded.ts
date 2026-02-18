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

/**
 * This module MUST be imported before any module that uses isFeatureEnabled().
 *
 * Some plugins (e.g., legacy-preset-chart-deckgl) call isFeatureEnabled()
 * at module load time when defining exports like jsDataMutator, jsTooltip, etc.
 * Since ES modules are executed when imported, we need to initialize feature
 * flags before those imports happen.
 *
 * This module also reads the ?locale= URL parameter for embedded dashboards,
 * allowing the SDK to specify the initial locale without flash.
 */
import { initFeatureFlags } from '@superset-ui/core';
import getBootstrapData from 'src/utils/getBootstrapData';
import { getUrlParam } from 'src/utils/urlUtils';
import { URL_PARAMS } from 'src/constants';

const bootstrapData = getBootstrapData();

// Initialize feature flags first - required before plugin imports
initFeatureFlags(bootstrapData.common.feature_flags);

// Determine locale: URL param takes priority over bootstrap data
// This allows SDK to pass ?locale=de for immediate correct rendering
const urlLocale = getUrlParam(URL_PARAMS.locale);
const locale = urlLocale || bootstrapData.common?.locale || 'en';

export { bootstrapData, locale };
