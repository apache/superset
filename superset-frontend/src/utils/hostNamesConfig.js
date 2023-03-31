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
import { FeatureFlag } from '@superset-ui/core';
import { initFeatureFlags, isFeatureEnabled } from 'src/featureFlags';
import getBootstrapData from './getBootstrapData';

function getDomainsConfig() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    return [];
  }

  const availableDomains = new Set([window.location.hostname]);

  // don't do domain sharding if a certain query param is set
  const disableDomainSharding =
    new URLSearchParams(window.location.search).get('disableDomainSharding') ===
    '1';
  if (disableDomainSharding) {
    return Array.from(availableDomains);
  }

  const bootstrapData = getBootstrapData();
  // this module is a little special, it may be loaded before index.jsx,
  // where window.featureFlags get initialized
  // eslint-disable-next-line camelcase
  initFeatureFlags(bootstrapData.common.feature_flags);

  if (
    isFeatureEnabled(FeatureFlag.ALLOW_DASHBOARD_DOMAIN_SHARDING) &&
    bootstrapData &&
    bootstrapData.common &&
    bootstrapData.common.conf &&
    bootstrapData.common.conf.SUPERSET_WEBSERVER_DOMAINS
  ) {
    bootstrapData.common.conf.SUPERSET_WEBSERVER_DOMAINS.forEach(hostName => {
      availableDomains.add(hostName);
    });
  }
  return Array.from(availableDomains);
}

export const availableDomains = getDomainsConfig();

export const allowCrossDomain = availableDomains.length > 1;
