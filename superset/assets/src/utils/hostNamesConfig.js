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
function getDomainsConfig() {
  const appContainer = document.getElementById('app');
  if (!appContainer) {
    return [];
  }

  const bootstrapData = JSON.parse(appContainer.getAttribute('data-bootstrap'));
  const availableDomains = new Set([location.hostname]);
  if (
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
